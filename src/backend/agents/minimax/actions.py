"""Action helpers for minimax search."""

from __future__ import annotations

from typing import Any, Dict, List

from .state_utils import clamp, clone_state


SHOT_ACTIONS = (
    "SMASH",
    "CLEAR",
    "DROP_SHOT",
    "DRIVE",
    "LOB",
    "NET_SHOT",
    "SPECIAL",
)
MOVEMENT_ACTIONS = ("MOVE_LEFT", "MOVE_RIGHT", "STAY")
ALL_ACTIONS = SHOT_ACTIONS + MOVEMENT_ACTIONS


def _get_config(config: Dict[str, Any], key: str, default):
    if not isinstance(config, dict):
        return default
    return config.get(key, default)


def _get_effects(config: Dict[str, Any], action: str) -> Dict[str, float]:
    effects = _get_config(config, "action_effects", {})
    if not isinstance(effects, dict):
        return {}
    return effects.get(action, {}) or {}


def get_valid_actions(
    state: Dict[str, Any],
    config: Dict[str, Any],
    *,
    include_movement_actions: bool = False,
) -> List[str]:
    """Return the valid action list for the current state."""
    actions: List[str] = list(SHOT_ACTIONS)
    if include_movement_actions:
        actions.extend(MOVEMENT_ACTIONS)

    constraints = _get_config(config, "action_constraints", {})
    stamina = state.get("stamina")
    power = state.get("power")

    min_smash = constraints.get("smash_min_stamina", 0)
    min_special = constraints.get("special_min_power", 0)

    if stamina is not None and stamina < min_smash and "SMASH" in actions:
        actions.remove("SMASH")
    if power is not None and power < min_special and "SPECIAL" in actions:
        actions.remove("SPECIAL")

    return actions


def apply_action(
    state: Dict[str, Any],
    action: str,
    *,
    actor: str,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply an action to a cloned state for minimax search."""
    next_state = clone_state(state)
    effects = _get_effects(config, action)

    normalization = _get_config(config, "normalization", {})
    stamina_max = float(normalization.get("stamina_max", 100))
    power_max = float(normalization.get("power_max", 100))
    height_min = float(normalization.get("height_min", 0.0))
    height_max = float(normalization.get("height_max", 5.0))
    zone_max = int(normalization.get("zone_max", 8))

    stamina_key = "stamina" if actor == "player" else "opponent_stamina"
    power_key = "power" if actor == "player" else "opponent_power"
    pos_key = "player_pos" if actor == "player" else "opponent_pos"

    stamina_cost = float(effects.get("stamina_cost", 0.0))
    power_delta = float(effects.get("power_delta", 0.0))
    height_delta = float(effects.get("height_delta", 0.0))
    zone_delta = int(effects.get("zone_delta", 0))
    pos_dx = float(effects.get("pos_dx", 0.0))

    stamina = next_state.get(stamina_key)
    if stamina is not None:
        next_state[stamina_key] = clamp(float(stamina) - stamina_cost, 0.0, stamina_max)

    power = next_state.get(power_key)
    if power is not None:
        next_state[power_key] = clamp(float(power) + power_delta, 0.0, power_max)

    height = next_state.get("shuttle_height")
    if height is not None:
        next_state["shuttle_height"] = clamp(float(height) + height_delta, height_min, height_max)

    zone = next_state.get("shuttle_zone")
    if zone is not None:
        zone_value = int(zone) + zone_delta
        next_state["shuttle_zone"] = max(1, min(zone_max, zone_value))

    pos = next_state.get(pos_key) or {"x": 0.5, "y": 0.5}
    if isinstance(pos, dict):
        pos["x"] = clamp(float(pos.get("x", 0.5)) + pos_dx, 0.0, 1.0)
        next_state[pos_key] = pos

    next_state["last_action"] = action
    return next_state
