"""State helpers for minimax search.

The minimax agent operates on a cloned, dictionary-based snapshot to avoid
mutating the authoritative GameState used by the simulator.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple


def _get(state: Any, attr: str, default=None):
    if state is None:
        return default
    if isinstance(state, dict):
        return state.get(attr, default)
    return getattr(state, attr, default)


def _clone_position(value: Any) -> Dict[str, float]:
    if not isinstance(value, dict):
        return {"x": 0.5, "y": 0.5}
    try:
        return {
            "x": float(value.get("x", 0.5)),
            "y": float(value.get("y", 0.5)),
        }
    except Exception:
        return {"x": 0.5, "y": 0.5}


def _clone_score(value: Any) -> Dict[str, int]:
    if isinstance(value, dict):
        try:
            return {
                "p1": int(value.get("p1", 0)),
                "p2": int(value.get("p2", 0)),
            }
        except Exception:
            return {"p1": 0, "p2": 0}
    return {"p1": 0, "p2": 0}


def clone_state(state: Any) -> Dict[str, Any]:
    """Return a deep-enough copy of the GameState for minimax search."""
    return {
        "player_pos": _clone_position(_get(state, "player_pos")),
        "opponent_pos": _clone_position(_get(state, "opponent_pos")),
        "shuttle_zone": _get(state, "shuttle_zone", 4),
        "shuttle_height": _get(state, "shuttle_height", 1.5),
        "stamina": _get(state, "stamina", 100),
        "opponent_stamina": _get(state, "opponent_stamina", 100),
        "power": _get(state, "power", 0),
        "opponent_power": _get(state, "opponent_power", 0),
        "score": _clone_score(_get(state, "score")),
        "current_turn": _get(state, "current_turn"),
        "last_action": _get(state, "last_action"),
    }


def state_key(state: Dict[str, Any], rounding: int = 3) -> Tuple[Any, ...]:
    """Build a hashable key for transposition caching."""
    def _r(value: Any):
        if value is None:
            return None
        try:
            return round(float(value), rounding)
        except Exception:
            return value

    player_pos = state.get("player_pos") or {}
    opponent_pos = state.get("opponent_pos") or {}
    score = state.get("score") or {}

    return (
        _r(player_pos.get("x")),
        _r(player_pos.get("y")),
        _r(opponent_pos.get("x")),
        _r(opponent_pos.get("y")),
        _r(state.get("shuttle_zone")),
        _r(state.get("shuttle_height")),
        _r(state.get("stamina")),
        _r(state.get("opponent_stamina")),
        _r(state.get("power")),
        _r(state.get("opponent_power")),
        score.get("p1"),
        score.get("p2"),
        state.get("current_turn"),
    )


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))
