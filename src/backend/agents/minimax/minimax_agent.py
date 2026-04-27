"""SmartSmash Minimax Agent.

Depth-limited minimax search with alpha-beta pruning and a transparent
heuristic evaluation. The agent is deterministic and consumes only the
GameState snapshot provided by the simulator.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

try:
	from agents.base_agent import BaseAgent
except Exception:  # pragma: no cover - fallback for direct script usage
	import os
	import sys
	sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
	from agents.base_agent import BaseAgent  # type: ignore

from utils.serializer import load_config_section

from .actions import ALL_ACTIONS, SHOT_ACTIONS
from .explanation import format_explanation
from .heuristic import evaluate_state
from .search import SearchStats, minimax_root
from .state_utils import clone_state

logger = logging.getLogger("smartsmash.agents.minimax")


class MinimaxAgent(BaseAgent):
	"""Depth-limited minimax agent with alpha-beta pruning.

	Parameters
	----------
	depth:
		Search depth limit. Defaults to config depth when omitted.
	include_movement_actions:
		If True, MOVE_LEFT / MOVE_RIGHT / STAY can be selected.
	return_explanation:
		If True, ``select_action`` returns a tuple ``(action, explanation)``.
	"""

	name = "Minimax"

	def __init__(
		self,
		*,
		depth: Optional[int] = None,
		include_movement_actions: Optional[bool] = None,
		return_explanation: bool = False,
	) -> None:
		backend_dir = Path(__file__).resolve().parents[2]
		config_path = backend_dir / "config" / "agent_config.yaml"

		config = load_config_section(str(config_path), "minimax", default={})
		if depth is not None:
			config["depth"] = int(depth)
		if include_movement_actions is not None:
			config["include_movement_actions"] = bool(include_movement_actions)

		self._config = config
		self._depth = int(config.get("depth", 3))
		self._return_explanation = return_explanation
		self._valid_actions = ALL_ACTIONS if config.get("include_movement_actions") else SHOT_ACTIONS
		self._last_decision: Optional[Dict[str, Any]] = None

	def select_action(self, state: Any):
		action, explanation = self.decide(state)
		if self._return_explanation:
			return action, explanation
		return action

	def decide(self, state: Any) -> Tuple[str, Dict[str, Any]]:
		"""Run minimax and return (action, explanation)."""
		t0 = time.perf_counter()
		snapshot = clone_state(state)

		stats = SearchStats()
		action, score, root_scores, stats = minimax_root(
			snapshot,
			self._depth,
			config=self._config,
			stats=stats,
		)

		_, breakdown = evaluate_state(snapshot, self._config, include_breakdown=True)
		features = breakdown.get("features", {})
		contributions = breakdown.get("contributions", {})

		top_actions = [
			{"action": name, "score": round(float(value), 4)}
			for name, value in sorted(root_scores.items(), key=lambda kv: kv[1], reverse=True)
		]
		top_n = int(self._config.get("top_actions", 3))
		top_actions = top_actions[: max(1, top_n)]

		decision_time_ms = (time.perf_counter() - t0) * 1000.0
		explanation = format_explanation(
			action=action,
			score=score,
			depth=self._depth,
			nodes_explored=stats.nodes_explored,
			cutoffs=stats.cutoffs,
			cache_hits=stats.cache_hits,
			features=features,
			contributions=contributions,
			top_actions=top_actions,
			decision_time_ms=decision_time_ms,
		)

		self._last_decision = explanation
		if logger.isEnabledFor(logging.DEBUG):
			logger.debug(
				"MinimaxAgent decision: action=%s score=%.3f depth=%d nodes=%d time_ms=%.2f",
				action,
				score,
				self._depth,
				stats.nodes_explored,
				decision_time_ms,
			)

		return action, explanation

	@property
	def last_decision(self) -> Optional[Dict[str, Any]]:
		return self._last_decision

	def info(self) -> Dict[str, Any]:
		return {
			"name": self.name,
			"type": "minimax",
			"algorithm": "Minimax with alpha-beta pruning",
			"valid_actions": list(self._valid_actions),
			"depth": self._depth,
			"config": dict(self._config),
		}
