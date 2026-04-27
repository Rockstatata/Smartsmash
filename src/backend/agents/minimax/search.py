"""Minimax search with alpha-beta pruning."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from .actions import get_valid_actions, apply_action
from .heuristic import evaluate_state
from .state_utils import state_key


@dataclass
class SearchStats:
	nodes_explored: int = 0
	cutoffs: int = 0
	cache_hits: int = 0


def _get_config(config: Dict[str, Any], key: str, default):
	if not isinstance(config, dict):
		return default
	return config.get(key, default)


def _order_actions(actions: List[str], config: Dict[str, Any]) -> List[str]:
	order = _get_config(config, "action_order", [])
	if not isinstance(order, list) or not order:
		return list(actions)

	priority = {name: idx for idx, name in enumerate(order)}
	return sorted(actions, key=lambda act: priority.get(act, len(priority)))


def _is_terminal(state: Dict[str, Any], config: Dict[str, Any]) -> bool:
	score = state.get("score") or {}
	points_to_win = int(_get_config(config, "points_to_win", 21))
	try:
		return int(score.get("p1", 0)) >= points_to_win or int(score.get("p2", 0)) >= points_to_win
	except Exception:
		return False


def minimax_search(
	state: Dict[str, Any],
	depth: int,
	*,
	maximizing: bool,
	config: Dict[str, Any],
	stats: SearchStats,
	alpha: float,
	beta: float,
	cache: Optional[Dict[Tuple[Any, ...], float]] = None,
) -> float:
	stats.nodes_explored += 1

	if depth <= 0 or _is_terminal(state, config):
		score, _ = evaluate_state(state, config, include_breakdown=False)
		return score

	cache_rounding = int(_get_config(config, "cache_rounding", 3))
	if cache is not None:
		key = (state_key(state, rounding=cache_rounding), depth, maximizing)
		if key in cache:
			stats.cache_hits += 1
			return cache[key]

	actions = get_valid_actions(
		state,
		config,
		include_movement_actions=bool(_get_config(config, "include_movement_actions", False)),
	)
	if not actions:
		score, _ = evaluate_state(state, config, include_breakdown=False)
		return score

	max_branching = int(_get_config(config, "max_branching", len(actions)))
	ordered = _order_actions(actions, config)
	ordered = ordered[: max(1, min(max_branching, len(ordered)))]

	pruning_enabled = bool(_get_config(config, "pruning", True))

	if maximizing:
		value = -float("inf")
		for action in ordered:
			next_state = apply_action(state, action, actor="player", config=config)
			score = minimax_search(
				next_state,
				depth - 1,
				maximizing=False,
				config=config,
				stats=stats,
				alpha=alpha,
				beta=beta,
				cache=cache,
			)
			value = max(value, score)
			if pruning_enabled:
				alpha = max(alpha, value)
				if alpha >= beta:
					stats.cutoffs += 1
					break
	else:
		value = float("inf")
		for action in ordered:
			next_state = apply_action(state, action, actor="opponent", config=config)
			score = minimax_search(
				next_state,
				depth - 1,
				maximizing=True,
				config=config,
				stats=stats,
				alpha=alpha,
				beta=beta,
				cache=cache,
			)
			value = min(value, score)
			if pruning_enabled:
				beta = min(beta, value)
				if alpha >= beta:
					stats.cutoffs += 1
					break

	if cache is not None:
		cache[key] = value

	return value


def minimax_root(
	state: Dict[str, Any],
	depth: int,
	*,
	config: Dict[str, Any],
	stats: Optional[SearchStats] = None,
) -> Tuple[str, float, Dict[str, float], SearchStats]:
	"""Evaluate root actions and return the best action and score map."""
	stats = stats or SearchStats()
	actions = get_valid_actions(
		state,
		config,
		include_movement_actions=bool(_get_config(config, "include_movement_actions", False)),
	)

	fallback = str(_get_config(config, "fallback_action", "DRIVE"))
	if not actions:
		score, _ = evaluate_state(state, config, include_breakdown=False)
		return fallback, score, {}, stats

	ordered = _order_actions(actions, config)
	max_branching = int(_get_config(config, "max_branching", len(ordered)))
	ordered = ordered[: max(1, min(max_branching, len(ordered)))]

	alpha = -float("inf")
	beta = float("inf")
	cache: Dict[Tuple[Any, ...], float] = {}
	scores: Dict[str, float] = {}

	best_action = ordered[0]
	best_score = -float("inf")

	for action in ordered:
		next_state = apply_action(state, action, actor="player", config=config)
		score = minimax_search(
			next_state,
			depth - 1,
			maximizing=False,
			config=config,
			stats=stats,
			alpha=alpha,
			beta=beta,
			cache=cache,
		)
		scores[action] = score
		if score > best_score:
			best_score = score
			best_action = action
		alpha = max(alpha, best_score)

	return best_action, best_score, scores, stats
