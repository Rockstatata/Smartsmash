"""SmartSmash agent registry and factory.

This module exposes a single ``make_agent`` function that the API layer
uses to instantiate the three classical AI agents by type. Each agent
implements the same ``select_action(state) -> str`` and
``decide(state) -> (action, explanation)`` interface, so callers can
swap them transparently.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .base_agent import BaseAgent
from .fuzzy import FuzzyAgent
from .mcts_agent import MCTSAgent
from .minimax import MinimaxAgent

AGENT_TYPES = ("minimax", "mcts", "fuzzy")


def make_agent(
    agent_type: str,
    *,
    player_key: str = "p1",
    options: Optional[Dict[str, Any]] = None,
) -> BaseAgent:
    """Instantiate an agent by type. Raises ``ValueError`` for unknown types.

    Parameters
    ----------
    agent_type:
        One of ``"minimax"``, ``"mcts"``, ``"fuzzy"``.
    player_key:
        Which side ('p1' or 'p2') the agent represents. Only MCTS uses
        this directly; the others are perspective-agnostic.
    options:
        Optional override dict (depth for minimax, simulations for mcts).
    """

    opts = dict(options or {})
    key = (agent_type or "").strip().lower()

    if key == "minimax":
        return MinimaxAgent(
            depth=opts.get("depth"),
            include_movement_actions=opts.get("include_movement_actions"),
            return_explanation=True,
        )

    if key == "mcts":
        return MCTSAgent(
            simulations=opts.get("simulations"),
            rollout_depth=int(opts.get("rollout_depth", 8)),
            exploration_constant=float(opts.get("exploration_constant", 1.414)),
            include_movement_actions=bool(opts.get("include_movement_actions", False)),
            return_explanation=True,
            player_key=player_key,
            seed=opts.get("seed"),
        )

    if key == "fuzzy":
        return FuzzyAgent(
            include_movement_actions=bool(opts.get("include_movement_actions", False)),
            return_explanation=True,
        )

    raise ValueError(f"Unknown agent type: {agent_type!r}")


__all__ = ["AGENT_TYPES", "BaseAgent", "FuzzyAgent", "MCTSAgent", "MinimaxAgent", "make_agent"]
