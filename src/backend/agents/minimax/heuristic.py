"""Heuristic evaluation for the minimax agent."""

from __future__ import annotations

import math
from typing import Any, Dict, Tuple

from .state_utils import clamp


def _get(state: Dict[str, Any], key: str, default):
	value = state.get(key, default)
	return default if value is None else value


def _pos(value: Any) -> Dict[str, float]:
	if not isinstance(value, dict):
		return {"x": 0.5, "y": 0.5}
	try:
		return {
			"x": float(value.get("x", 0.5)),
			"y": float(value.get("y", 0.5)),
		}
	except Exception:
		return {"x": 0.5, "y": 0.5}


def _distance(a: Dict[str, float], b: Dict[str, float]) -> float:
	dx = float(a.get("x", 0.5)) - float(b.get("x", 0.5))
	dy = float(a.get("y", 0.5)) - float(b.get("y", 0.5))
	return math.sqrt(dx * dx + dy * dy)


def _zone_target(
	zone: int,
	*,
	zone_max: int,
	front_zone_max: int,
	depth_front_y: float,
	depth_back_y: float,
) -> Dict[str, float]:
	safe_zone = max(1, min(zone_max, int(zone)))
	lateral = (safe_zone - 1) / max(1, zone_max - 1)
	depth = depth_front_y if safe_zone <= front_zone_max else depth_back_y
	return {"x": lateral, "y": depth}


def extract_features(state: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
	"""Extract normalized features used by the minimax heuristic."""
	normalization = config.get("normalization", {})
	thresholds = config.get("thresholds", {})

	stamina_max = float(normalization.get("stamina_max", 100))
	power_max = float(normalization.get("power_max", 100))
	height_min = float(normalization.get("height_min", 0.0))
	height_max = float(normalization.get("height_max", 5.0))
	zone_max = int(normalization.get("zone_max", 8))
	score_scale = float(normalization.get("score_scale", 5))
	distance_norm = float(normalization.get("distance_norm", 1.4))
	depth_front_y = float(normalization.get("depth_front_y", 0.25))
	depth_back_y = float(normalization.get("depth_back_y", 0.75))

	front_zone_max = int(thresholds.get("front_zone_max", 4))
	attack_height = float(thresholds.get("attack_height", 1.8))
	defense_height = float(thresholds.get("defense_height", 0.9))
	opponent_near = float(thresholds.get("opponent_near", 0.35))
	low_stamina = float(thresholds.get("low_stamina", 30))

	height = float(_get(state, "shuttle_height", 1.5))
	zone = int(_get(state, "shuttle_zone", 4))
	stamina = float(_get(state, "stamina", stamina_max))
	opponent_stamina = float(_get(state, "opponent_stamina", stamina_max))
	power = float(_get(state, "power", 0))
	opponent_power = float(_get(state, "opponent_power", 0))

	score = state.get("score") or {}
	try:
		score_diff = float(score.get("p1", 0)) - float(score.get("p2", 0))
	except Exception:
		score_diff = 0.0

	player_pos = _pos(state.get("player_pos"))
	opponent_pos = _pos(state.get("opponent_pos"))

	shuttle_pos = _zone_target(
		zone,
		zone_max=zone_max,
		front_zone_max=front_zone_max,
		depth_front_y=depth_front_y,
		depth_back_y=depth_back_y,
	)

	player_to_shuttle = _distance(player_pos, shuttle_pos)
	opponent_to_shuttle = _distance(opponent_pos, shuttle_pos)
	opponent_distance = _distance(player_pos, opponent_pos)

	height_norm = clamp((height - height_min) / max(0.1, height_max - height_min), 0.0, 1.0)
	stamina_norm = clamp(stamina / max(1.0, stamina_max), 0.0, 1.0)
	opponent_stamina_norm = clamp(opponent_stamina / max(1.0, stamina_max), 0.0, 1.0)
	power_norm = clamp(power / max(1.0, power_max), 0.0, 1.0)
	opponent_power_norm = clamp(opponent_power / max(1.0, power_max), 0.0, 1.0)

	positional_advantage = clamp(
		(opponent_to_shuttle - player_to_shuttle) / max(0.1, distance_norm),
		-1.0,
		1.0,
	)

	stamina_advantage = clamp((stamina - opponent_stamina) / max(1.0, stamina_max), -1.0, 1.0)
	power_advantage = clamp((power - opponent_power) / max(1.0, power_max), -1.0, 1.0)

	offensive_weights = config.get("offensive_weights", {})
	defensive_weights = config.get("defensive_weights", {})

	opponent_distance_norm = clamp(opponent_distance / max(0.1, distance_norm), 0.0, 1.0)
	offensive_opportunity = (
		offensive_weights.get("height", 0.0) * height_norm
		+ offensive_weights.get("opponent_distance", 0.0) * opponent_distance_norm
		+ offensive_weights.get("power", 0.0) * power_norm
	)

	low_height = clamp((defense_height - height) / max(0.1, defense_height), 0.0, 1.0)
	opponent_near_score = clamp((opponent_near - opponent_distance) / max(0.1, opponent_near), 0.0, 1.0)
	defensive_risk = (
		defensive_weights.get("low_height", 0.0) * low_height
		+ defensive_weights.get("opponent_near", 0.0) * opponent_near_score
	)

	score_pressure = math.tanh(score_diff / max(1.0, score_scale))

	if height >= attack_height and opponent_distance >= opponent_near:
		rally_state = "attack"
	elif height <= defense_height or stamina <= low_stamina:
		rally_state = "defense"
	else:
		rally_state = "neutral"

	return {
		"positional_advantage": positional_advantage,
		"stamina_advantage": stamina_advantage,
		"power_advantage": power_advantage,
		"offensive_opportunity": clamp(offensive_opportunity, 0.0, 1.0),
		"defensive_risk": clamp(defensive_risk, 0.0, 1.0),
		"score_pressure": clamp(score_pressure, -1.0, 1.0),
		"rally_state": rally_state,
		"stamina": stamina_norm,
		"opponent_stamina": opponent_stamina_norm,
		"power": power_norm,
		"opponent_power": opponent_power_norm,
		"shuttle_height": height_norm,
		"opponent_distance": opponent_distance_norm,
		"score_diff": score_diff,
	}


def evaluate_state(
	state: Dict[str, Any],
	config: Dict[str, Any],
	*,
	include_breakdown: bool = False,
) -> Tuple[float, Dict[str, Any]]:
	"""Return heuristic score (and optional breakdown) for a state."""
	features = extract_features(state, config)
	weights = config.get("weights", {})
	rally_biases = config.get("rally_state_biases", {})

	rally_bias = float(rally_biases.get(features.get("rally_state", "neutral"), 0.0))
	contributions = {
		"positional_advantage": weights.get("positional_advantage", 0.0) * features["positional_advantage"],
		"stamina_advantage": weights.get("stamina_advantage", 0.0) * features["stamina_advantage"],
		"power_advantage": weights.get("power_advantage", 0.0) * features["power_advantage"],
		"offensive_opportunity": weights.get("offensive_opportunity", 0.0) * features["offensive_opportunity"],
		"defensive_risk": weights.get("defensive_risk", 0.0) * features["defensive_risk"],
		"score_pressure": weights.get("score_pressure", 0.0) * features["score_pressure"],
		"rally_state_bias": weights.get("rally_state_bias", 0.0) * rally_bias,
	}

	raw_score = sum(contributions.values())
	norm = sum(abs(float(v)) for v in weights.values()) or 1.0
	score = clamp(raw_score / norm, -1.0, 1.0)

	breakdown = {
		"features": features,
		"contributions": contributions,
		"raw_score": raw_score,
		"normalized_score": score,
	}

	if include_breakdown:
		return score, breakdown
	return score, {}
