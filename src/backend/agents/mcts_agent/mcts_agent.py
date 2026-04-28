"""SmartSmash Monte Carlo Tree Search (MCTS) agent.

This agent follows the PRD requirements:
- Consumes only a GameState-like object (object attrs or dict keys)
- Returns exactly one valid action per decision turn
- Fully decoupled from UI / rendering
- Explainable via a structured metadata payload

The implementation is intentionally self-contained because the current backend
simulation layer is still a lightweight stub. For planning, MCTS uses an
internal stochastic rollout model that respects the PRD resource mechanics
(stamina + power) and the action vocabulary already used by the platform.
"""

from __future__ import annotations

import logging
import random
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

try:
    # Preferred when imported as a package (agents.mcts_agent.mcts_agent).
    from agents.base_agent import BaseAgent
except Exception:  # pragma: no cover - fallback for direct script usage
    import os
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from agents.base_agent import BaseAgent  # type: ignore

try:
    import yaml
except Exception:  # pragma: no cover
    yaml = None

from .backpropagation import backpropagate
from .expansion import expand_once
from .explanation import format_explanation
from .node import Node
from .selection import select_child_uct
from .simulation import is_terminal, rollout
from .utils import DEFAULT_TARGET_SCORE, generate_valid_actions, other_player, to_internal_state

logger = logging.getLogger("smartsmash.agents.mcts")


def _load_agent_config() -> Dict[str, Any]:
    """Load `config/agent_config.yaml` if present."""

    if yaml is None:
        return {}

    backend_dir = Path(__file__).resolve().parents[2]
    path = backend_dir / "config" / "agent_config.yaml"
    if not path.exists():
        return {}

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


class MCTSAgent(BaseAgent):
    """Production-ready MCTS agent with UCT selection and explainability."""

    name = "MCTS"

    def __init__(
        self,
        *,
        simulations: Optional[int] = None,
        rollout_depth: int = 8,
        exploration_constant: float = 1.414,
        include_movement_actions: bool = False,
        return_explanation: bool = False,
        player_key: str = "p1",
        seed: Optional[int] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> None:
        raw_cfg = _load_agent_config().get("mcts", {})
        file_cfg = raw_cfg if isinstance(raw_cfg, dict) else {}

        merged: Dict[str, Any] = {
            "simulations": 1000,
            "rollout_depth": int(rollout_depth),
            "exploration_constant": float(exploration_constant),
            "target_score": DEFAULT_TARGET_SCORE,
            # PRD-ish resource constraints.
            "min_smash_stamina": 30.0,
            "min_special_stamina": 30.0,
            "min_special_power": 60.0,
            "allow_special": True,
            # Simple rollout tuning.
            "stamina_recovery": 2.0,
            "defender_stamina_cost": 1.5,
        }
        merged.update(file_cfg)
        if config:
            merged.update(config)

        if simulations is not None:
            merged["simulations"] = int(simulations)

        merged["rollout_depth"] = int(merged.get("rollout_depth", rollout_depth) or rollout_depth)
        merged["exploration_constant"] = float(
            merged.get("exploration_constant", exploration_constant) or exploration_constant
        )

        self._config = merged
        self._include_movement_actions = bool(include_movement_actions)
        self._return_explanation = bool(return_explanation)

        self._player_key = "p2" if str(player_key).lower() == "p2" else "p1"

        # Deterministic when a seed is provided.
        self._rng = random.Random(seed)

        self._last_decision: Optional[Dict[str, Any]] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def select_action(self, state: Any):
        action, explanation = self.decide(state)
        if self._return_explanation:
            return action, explanation
        return action

    def decide(self, state: Any) -> Tuple[str, Dict[str, Any]]:
        """Run a full MCTS search. Always returns (action, explanation)."""

        t0 = time.perf_counter()

        internal = to_internal_state(
            state,
            perspective_player=self._player_key,
            default_target_score=int(self._config.get("target_score", DEFAULT_TARGET_SCORE)),
        )

        # Terminal / degenerate state fallback.
        if internal.get("is_terminal") or is_terminal(internal):
            action = "DRIVE"
            decision_time_ms = (time.perf_counter() - t0) * 1000.0
            explanation = format_explanation(
                action=action,
                root=Node(state=internal),
                simulations=0,
                tree_depth=0,
                decision_time_ms=decision_time_ms,
            )
            self._last_decision = explanation
            return action, explanation

        root_actions = generate_valid_actions(
            internal,
            include_movement_actions=self._include_movement_actions,
            config=self._config,
        )

        root = Node(
            state=internal,
            parent=None,
            action=None,
            player_just_moved=other_player(str(internal.get("current_turn", "p1"))),
            depth=0,
            untried_actions=root_actions,
        )

        simulations = max(1, int(self._config.get("simulations", 1000) or 1000))
        rollout_depth = max(1, int(self._config.get("rollout_depth", 8) or 8))
        exploration_constant = float(self._config.get("exploration_constant", 1.414) or 1.414)

        max_tree_depth = 0

        for _ in range(simulations):
            node = root

            # 1) Selection: descend while fully expanded.
            while (
                not is_terminal(node.state)
                and node.is_fully_expanded()
                and node.children
            ):
                node = select_child_uct(
                    node,
                    exploration_constant=exploration_constant,
                    rng=self._rng,
                )

            # 2) Expansion: expand one untried action.
            if not is_terminal(node.state) and node.untried_actions:
                node = expand_once(
                    node,
                    rng=self._rng,
                    config=self._config,
                    include_movement_actions=self._include_movement_actions,
                )

            if node.depth > max_tree_depth:
                max_tree_depth = node.depth

            # 3) Simulation: rollout from this node.
            winner = rollout(
                node.state,
                max_depth=rollout_depth,
                rng=self._rng,
                config=self._config,
                include_movement_actions=self._include_movement_actions,
            )

            # 4) Backpropagation.
            backpropagate(node, winner)

        # Choose action: highest visit count (robust), break ties by win rate.
        best_action = "DRIVE"
        if root.children:
            best_visits = -1
            best_value = -1.0
            for action, child in root.children.items():
                if child.visits > best_visits:
                    best_action = action
                    best_visits = child.visits
                    best_value = child.mean_value()
                elif child.visits == best_visits:
                    v = child.mean_value()
                    if v > best_value:
                        best_action = action
                        best_value = v

        decision_time_ms = (time.perf_counter() - t0) * 1000.0
        explanation = format_explanation(
            action=best_action,
            root=root,
            simulations=simulations,
            tree_depth=max_tree_depth,
            decision_time_ms=decision_time_ms,
        )

        self._last_decision = explanation

        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "MCTSAgent decision: action=%s win_rate=%.3f sims=%d depth=%d time_ms=%.2f",
                best_action,
                float(explanation.get("win_rate", 0.0)),
                simulations,
                max_tree_depth,
                decision_time_ms,
            )

        return best_action, explanation

    # ------------------------------------------------------------------
    # Introspection helpers (used by API / evaluation layers).
    # ------------------------------------------------------------------
    @property
    def last_decision(self) -> Optional[Dict[str, Any]]:
        return self._last_decision

    def info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": "mcts",
            "algorithm": "Monte Carlo Tree Search (UCT)",
            "config": {
                "simulations": int(self._config.get("simulations", 1000)),
                "rollout_depth": int(self._config.get("rollout_depth", 8)),
                "exploration_constant": float(self._config.get("exploration_constant", 1.414)),
                "include_movement_actions": bool(self._include_movement_actions),
                "player_key": self._player_key,
            },
            "description": "Simulation-based search with UCT selection and stochastic rollouts.",
        }
