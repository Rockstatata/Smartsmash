from __future__ import annotations

import copy
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Concrete action vocabulary used throughout the backend.
SHOT_ACTIONS: Tuple[str, ...] = (
    "SMASH",
    "CLEAR",
    "DROP_SHOT",
    "DRIVE",
    "LOB",
    "NET_SHOT",
    "SPECIAL",
)
MOVEMENT_ACTIONS: Tuple[str, ...] = ("MOVE_LEFT", "MOVE_RIGHT", "STAY")
ALL_ACTIONS: Tuple[str, ...] = SHOT_ACTIONS + MOVEMENT_ACTIONS

DEFAULT_TARGET_SCORE = 5


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def other_player(player: str) -> str:
    if player == "p1":
        return "p2"
    return "p1"


def _get(state: Any, attr: str, default=None):
    if state is None:
        return default
    if isinstance(state, dict):
        return state.get(attr, default)
    return getattr(state, attr, default)


def _coerce_float(value: Any, default: float) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def _coerce_int(value: Any, default: int) -> int:
    try:
        if value is None:
            return int(default)
        return int(value)
    except Exception:
        return int(default)


def _coerce_pos(value: Any) -> Dict[str, float]:
    if isinstance(value, dict):
        return {
            "x": _coerce_float(value.get("x", 0.5), 0.5),
            "y": _coerce_float(value.get("y", 0.5), 0.5),
        }
    return {"x": 0.5, "y": 0.5}


def _coerce_score(value: Any) -> Dict[str, int]:
    if isinstance(value, dict):
        return {
            "p1": _coerce_int(value.get("p1", 0), 0),
            "p2": _coerce_int(value.get("p2", 0), 0),
        }
    return {"p1": 0, "p2": 0}


def clone_state(state: Dict) -> Dict:
    """Deep copy the internal state dict.

    Internal state is kept intentionally small, so deepcopy is reliable and
    still fast enough for typical MCTS budgets.
    """

    return copy.deepcopy(state)


def normalise_current_turn(
    raw_turn: Any,
    *,
    perspective_player: str,
) -> str:
    """Map possibly-relative current_turn tokens onto ('p1'|'p2')."""
    if raw_turn in ("p1", "p2"):
        return str(raw_turn)

    if raw_turn in ("player", "self", "me"):
        return perspective_player

    if raw_turn in ("opponent", "other"):
        return other_player(perspective_player)

    return perspective_player


def to_internal_state(
    state: Any,
    *,
    perspective_player: str = "p1",
    default_target_score: int = DEFAULT_TARGET_SCORE,
) -> Dict:
    """Convert an incoming GameState-like object to an internal dict.

    The codebase currently uses a lightweight `GameState` class for the backend
    API bridge, but agents are written to tolerate dict-like states. This helper
    makes MCTS robust to either representation.

    Parameters
    ----------
    perspective_player:
        Which scoreboard side ('p1' or 'p2') the caller's `player_*` fields refer
        to. For `perspective_player='p1'`, input fields are interpreted as:
            player_* -> p1_*
            opponent_* -> p2_*
        For `perspective_player='p2'`, the mapping is reversed.
    """

    perspective_player = "p1" if perspective_player != "p2" else "p2"

    # Support both "player_pos" style and explicit "p1_pos" style.
    player_pos = _coerce_pos(_get(state, "player_pos", _get(state, f"{perspective_player}_pos")))
    opponent_pos = _coerce_pos(_get(state, "opponent_pos", _get(state, f"{other_player(perspective_player)}_pos")))

    stamina = _coerce_float(_get(state, "stamina", _get(state, f"{perspective_player}_stamina", 100.0)), 100.0)
    opponent_stamina = _coerce_float(
        _get(state, "opponent_stamina", _get(state, f"{other_player(perspective_player)}_stamina", 100.0)),
        100.0,
    )

    power = _coerce_float(_get(state, "power", _get(state, f"{perspective_player}_power", 0.0)), 0.0)
    opponent_power = _coerce_float(
        _get(state, "opponent_power", _get(state, f"{other_player(perspective_player)}_power", 0.0)),
        0.0,
    )

    score = _coerce_score(_get(state, "score", None))

    # Map relative fields to absolute p1/p2.
    if perspective_player == "p1":
        p1_pos, p2_pos = player_pos, opponent_pos
        p1_stamina, p2_stamina = stamina, opponent_stamina
        p1_power, p2_power = power, opponent_power
    else:
        p2_pos, p1_pos = player_pos, opponent_pos
        p2_stamina, p1_stamina = stamina, opponent_stamina
        p2_power, p1_power = power, opponent_power

    target_score = _coerce_int(_get(state, "target_score", default_target_score), default_target_score)
    rally = _coerce_int(_get(state, "rally", 0), 0)

    raw_turn = _get(state, "current_turn", None)
    current_turn = normalise_current_turn(raw_turn, perspective_player=perspective_player)

    shuttle_zone = _coerce_int(_get(state, "shuttle_zone", 4), 4)
    shuttle_height = _coerce_float(_get(state, "shuttle_height", 1.5), 1.5)

    is_terminal_flag = bool(_get(state, "is_terminal", False))
    is_terminal = is_terminal_flag or (
        score.get("p1", 0) >= target_score or score.get("p2", 0) >= target_score
    )

    return {
        "p1_pos": p1_pos,
        "p2_pos": p2_pos,
        "shuttle_zone": shuttle_zone,
        "shuttle_height": shuttle_height,
        "p1_stamina": clamp(p1_stamina, 0.0, 100.0),
        "p2_stamina": clamp(p2_stamina, 0.0, 100.0),
        "p1_power": clamp(p1_power, 0.0, 100.0),
        "p2_power": clamp(p2_power, 0.0, 100.0),
        "active_power": _get(state, "active_power", None),
        "score": score,
        "current_turn": current_turn,
        "target_score": target_score,
        "rally": rally,
        "is_terminal": is_terminal,
    }


def score_diff(state: Dict, player: str) -> int:
    score = state.get("score") or {}
    if player == "p2":
        return int(score.get("p2", 0) - score.get("p1", 0))
    return int(score.get("p1", 0) - score.get("p2", 0))


def distance_between_players(state: Dict) -> float:
    p1 = state.get("p1_pos") or {"x": 0.5, "y": 0.5}
    p2 = state.get("p2_pos") or {"x": 0.5, "y": 0.5}
    try:
        dx = float(p2.get("x", 0.5)) - float(p1.get("x", 0.5))
        dy = float(p2.get("y", 0.5)) - float(p1.get("y", 0.5))
        return float((dx * dx + dy * dy) ** 0.5)
    except Exception:
        return 0.5


def generate_valid_actions(
    state: Dict,
    *,
    include_movement_actions: bool,
    config: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """Return all valid actions for the player to move in `state`."""

    cfg = config or {}
    player = str(state.get("current_turn", "p1"))

    stamina = float(state.get(f"{player}_stamina", 100.0))
    power = float(state.get(f"{player}_power", 0.0))

    min_smash_stamina = float(cfg.get("min_smash_stamina", 30.0))
    min_special_stamina = float(cfg.get("min_special_stamina", 40.0))
    min_special_power = float(cfg.get("min_special_power", 100.0))
    allow_special = bool(cfg.get("allow_special", True))

    actions: List[str] = list(SHOT_ACTIONS)

    if stamina < min_smash_stamina and "SMASH" in actions:
        actions.remove("SMASH")

    if (not allow_special) and "SPECIAL" in actions:
        actions.remove("SPECIAL")
    elif power < min_special_power or stamina < min_special_stamina:
        if "SPECIAL" in actions:
            actions.remove("SPECIAL")

    if include_movement_actions:
        actions.extend(MOVEMENT_ACTIONS)

    # Ensure we always have at least one safe default.
    if not actions:
        actions = ["DRIVE"]

    return actions


def iter_child_stats(node_children: Iterable[Tuple[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for action, child in node_children:
        visits = int(getattr(child, "visits", 0) or 0)
        value = float(getattr(child, "total_value", 0.0) or 0.0)
        win_rate = (value / visits) if visits > 0 else 0.0
        out.append(
            {
                "action": action,
                "visits": visits,
                "value": value,
                "win_rate": win_rate,
                "depth": int(getattr(child, "depth", 0) or 0),
            }
        )
    return out
