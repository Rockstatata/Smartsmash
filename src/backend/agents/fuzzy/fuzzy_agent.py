"""SmartSmash Fuzzy Logic Agent.

A drop-in BaseAgent implementation that consumes only the GameState and
returns one valid action per turn. The agent is fully self-contained: no
external fuzzy libraries, no rendering / UI dependencies, no mutation of
the game state.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional, Tuple

try:
    # Preferred when imported as a package (agents.fuzzy.fuzzy_agent).
    from agents.base_agent import BaseAgent
except Exception:  # pragma: no cover - fallback for direct script usage
    import os
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from agents.base_agent import BaseAgent  # type: ignore

from .defuzzifier import ALL_ACTIONS, SHOT_ACTIONS, select_action
from .explanation import format_explanation
from .inference import aggregate_intents, evaluate_rules, fuzzify_state
from .rules import get_rules

logger = logging.getLogger("smartsmash.agents.fuzzy")


class FuzzyAgent(BaseAgent):
    """Mamdani-style fuzzy logic agent.

    Parameters
    ----------
    include_movement_actions:
        If True, MOVE_LEFT / MOVE_RIGHT / STAY are eligible primary outputs.
        Default False so the agent always returns a rally-relevant shot,
        matching the action vocabulary the simulator currently consumes.
    return_explanation:
        If True, ``select_action`` returns a tuple ``(action, explanation)``.
        Default False so the agent stays interface-compatible with
        ``BaseAgent.select_action(state) -> action``.
    """

    name = "Fuzzy"

    def __init__(
        self,
        *,
        include_movement_actions: bool = False,
        return_explanation: bool = False,
    ) -> None:
        self._rules = get_rules()
        self._valid_actions = ALL_ACTIONS if include_movement_actions else SHOT_ACTIONS
        self._return_explanation = return_explanation
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
        """Run the full fuzzy pipeline. Always returns (action, explanation)."""
        t0 = time.perf_counter()

        fuzzy_values = fuzzify_state(state)
        fired = evaluate_rules(fuzzy_values, self._rules)
        intents = aggregate_intents(fired)
        action, confidence, scores = select_action(
            intents, valid_actions=self._valid_actions
        )

        decision_time_ms = (time.perf_counter() - t0) * 1000.0
        explanation = format_explanation(action, confidence, fired, fuzzy_values, scores)
        explanation["decision_time_ms"] = round(decision_time_ms, 3)
        explanation["intents"] = {
            intent: {k: round(v, 4) for k, v in sets.items()}
            for intent, sets in intents.items()
        }

        self._last_decision = explanation
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "FuzzyAgent decision: action=%s confidence=%.3f rules_fired=%d time_ms=%.2f",
                action,
                confidence,
                len(fired),
                decision_time_ms,
            )
        return action, explanation

    # ------------------------------------------------------------------
    # Introspection helpers (used by API / evaluation layers).
    # ------------------------------------------------------------------
    @property
    def last_decision(self) -> Optional[Dict[str, Any]]:
        return self._last_decision

    def info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": "fuzzy",
            "rules": len(self._rules),
            "valid_actions": list(self._valid_actions),
            "algorithm": "Mamdani fuzzy inference",
        }
