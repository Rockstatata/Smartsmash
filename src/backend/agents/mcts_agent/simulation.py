from __future__ import annotations

import random
from typing import Any, Dict, Optional, Tuple

from .utils import (
    clamp,
    clone_state,
    distance_between_players,
    generate_valid_actions,
    other_player,
    score_diff,
)


def is_terminal(state: Dict) -> bool:
    if bool(state.get("is_terminal")):
        return True
    score = state.get("score") or {}
    target = int(state.get("target_score") or 5)
    return int(score.get("p1", 0)) >= target or int(score.get("p2", 0)) >= target


def winner_from_state(state: Dict) -> Optional[str]:
    score = state.get("score") or {}
    p1 = int(score.get("p1", 0))
    p2 = int(score.get("p2", 0))
    if p1 == p2:
        return None
    return "p1" if p1 > p2 else "p2"


def _zone_flags(zone: int) -> Tuple[bool, bool, bool]:
    """Return (front, back, centerish) flags from a 1..8 zone."""
    z = int(zone or 4)
    front = z <= 4
    back = z >= 5
    centerish = 3 <= z <= 6
    return front, back, centerish


def estimate_point_win_probability(
    state: Dict,
    *,
    action: str,
    actor: str,
) -> float:
    """Stochastic referee model for rollouts.

    This is intentionally lightweight: it uses only the fields available in
    the current backend `GameState` and the PRD-required resource mechanics.
    """

    defender = other_player(actor)

    height = float(state.get("shuttle_height", 1.5) or 1.5)
    height_norm = clamp(height / 3.0, 0.0, 1.25)

    zone = int(state.get("shuttle_zone", 4) or 4)
    front, back, centerish = _zone_flags(zone)

    stamina = float(state.get(f"{actor}_stamina", 100.0) or 100.0)
    stamina_norm = clamp(stamina / 100.0, 0.0, 1.0)

    power = float(state.get(f"{actor}_power", 0.0) or 0.0)
    power_norm = clamp(power / 100.0, 0.0, 1.0)

    opp_stamina = float(state.get(f"{defender}_stamina", 100.0) or 100.0)
    opp_stamina_norm = clamp(opp_stamina / 100.0, 0.0, 1.0)

    dist = distance_between_players(state)
    dist_norm = clamp(dist / 1.0, 0.0, 1.5)

    diff = score_diff(state, actor)
    losing = diff < 0
    winning = diff > 0

    # Baselines are calibrated to keep outcomes non-degenerate.
    if action == "SMASH":
        p = 0.45
        p += 0.20 * clamp(height_norm - 0.4, 0.0, 1.0)
        p += 0.14 * power_norm
        p += 0.10 * (1.0 - opp_stamina_norm)
        p += 0.05 * clamp(dist_norm - 0.45, 0.0, 1.0)
        p -= 0.30 * (1.0 - stamina_norm)
        p += 0.04 if losing else 0.0
        p -= 0.02 if winning else 0.0

    elif action == "SPECIAL":
        p = 0.56
        p += 0.18 * clamp(height_norm - 0.2, 0.0, 1.0)
        p += 0.30 * power_norm
        p += 0.08 * (1.0 - opp_stamina_norm)
        p -= 0.18 * (1.0 - stamina_norm)

    elif action in ("CLEAR", "LOB"):
        p = 0.50
        p += 0.06 * (1.0 - opp_stamina_norm)
        p += 0.04 if back else 0.0
        p += 0.03 if stamina_norm < 0.45 else 0.0
        p -= 0.05 * clamp(0.4 - height_norm, 0.0, 0.4)
        p += 0.02 if centerish else 0.0

    elif action in ("DROP_SHOT", "NET_SHOT"):
        p = 0.49
        p += 0.07 * clamp(dist_norm - 0.35, 0.0, 1.0)
        p += 0.06 if front else 0.0
        p += 0.06 * (1.0 - opp_stamina_norm)
        p -= 0.10 * clamp(height_norm - 1.0, 0.0, 0.4)
        p -= 0.12 * clamp(0.28 - stamina_norm, 0.0, 0.28)

    elif action == "DRIVE":
        p = 0.50
        # Best when height is medium-ish.
        p += 0.06 * (1.0 - abs(height_norm - 0.55))
        p += 0.04 * (1.0 - opp_stamina_norm)
        p -= 0.08 * clamp(0.25 - stamina_norm, 0.0, 0.25)

    elif action in ("MOVE_LEFT", "MOVE_RIGHT", "STAY"):
        # Movement doesn't win rallies directly in this abstraction.
        p = 0.46 + 0.04 * stamina_norm

    else:
        p = 0.50

    return float(clamp(p, 0.05, 0.95))


def _default_stamina_cost(action: str) -> float:
    return {
        "SMASH": 14.0,
        "SPECIAL": 10.0,
        "CLEAR": 7.0,
        "LOB": 7.0,
        "DRIVE": 8.0,
        "DROP_SHOT": 6.0,
        "NET_SHOT": 6.0,
        "MOVE_LEFT": 3.0,
        "MOVE_RIGHT": 3.0,
        "STAY": 1.0,
    }.get(action, 7.0)


def _default_power_gain(action: str) -> float:
    return {
        "SMASH": 10.0,
        "SPECIAL": 0.0,
        "CLEAR": 7.0,
        "LOB": 7.0,
        "DRIVE": 8.0,
        "DROP_SHOT": 6.0,
        "NET_SHOT": 6.0,
        "MOVE_LEFT": 3.0,
        "MOVE_RIGHT": 3.0,
        "STAY": 2.0,
    }.get(action, 6.0)


def _sample_next_shuttle_context(
    *,
    rng: random.Random,
    action: str,
) -> Tuple[int, float]:
    """Sample (zone, height) for the next rally, conditioned on the last action."""
    if action in ("CLEAR", "LOB"):
        return rng.randint(5, 8), rng.uniform(2.2, 3.6)

    if action in ("DROP_SHOT", "NET_SHOT"):
        return rng.randint(1, 4), rng.uniform(0.3, 1.2)

    if action == "DRIVE":
        return rng.randint(3, 6), rng.uniform(0.9, 1.9)

    if action == "SMASH":
        return rng.randint(2, 7), rng.uniform(1.7, 3.1)

    if action == "SPECIAL":
        return rng.randint(2, 7), rng.uniform(1.9, 3.5)

    # Movement or unknown action: reset to a typical mid rally.
    return rng.randint(1, 8), rng.uniform(0.8, 2.3)


def transition(
    state: Dict,
    *,
    action: str,
    rng: random.Random,
    config: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict, Optional[str]]:
    """Apply an action to the internal state (stochastic), returning (next_state, point_winner)."""

    cfg = config or {}

    if is_terminal(state):
        return clone_state(state), winner_from_state(state)

    actor = str(state.get("current_turn", "p1"))
    defender = other_player(actor)

    next_state = clone_state(state)

    # Resource updates (PRD: stamina cost, power gain).
    stamina_costs = cfg.get("stamina_costs") if isinstance(cfg.get("stamina_costs"), dict) else {}
    cost = float(stamina_costs.get(action, _default_stamina_cost(action)))

    next_state[f"{actor}_stamina"] = clamp(
        float(next_state.get(f"{actor}_stamina", 100.0)) - cost,
        0.0,
        100.0,
    )

    # Defender pays a small reactive cost.
    defender_cost = float(cfg.get("defender_stamina_cost", 1.5))
    next_state[f"{defender}_stamina"] = clamp(
        float(next_state.get(f"{defender}_stamina", 100.0)) - defender_cost,
        0.0,
        100.0,
    )

    power_gain = float(cfg.get("power_gain", _default_power_gain(action)))
    next_state[f"{actor}_power"] = clamp(
        float(next_state.get(f"{actor}_power", 0.0)) + power_gain,
        0.0,
        100.0,
    )
    next_state[f"{defender}_power"] = clamp(
        float(next_state.get(f"{defender}_power", 0.0)) + 0.6 * power_gain,
        0.0,
        100.0,
    )

    if action == "SPECIAL":
        next_state[f"{actor}_power"] = 0.0
        next_state["active_power"] = "SPECIAL"
    else:
        next_state["active_power"] = None

    # Decide who wins the rally point.
    win_prob = estimate_point_win_probability(state, action=action, actor=actor)
    point_winner = actor if rng.random() < win_prob else defender

    score = next_state.get("score") or {"p1": 0, "p2": 0}
    score[point_winner] = int(score.get(point_winner, 0)) + 1
    next_state["score"] = score

    next_state["rally"] = int(next_state.get("rally", 0)) + 1

    # Winner serves / acts next (mirrors the frontend rally reset behaviour).
    next_state["current_turn"] = point_winner

    zone, height = _sample_next_shuttle_context(rng=rng, action=action)
    next_state["shuttle_zone"] = zone
    next_state["shuttle_height"] = height

    # Small between-rally recovery.
    recovery = float(cfg.get("stamina_recovery", 2.0))
    next_state["p1_stamina"] = clamp(float(next_state.get("p1_stamina", 100.0)) + recovery, 0.0, 100.0)
    next_state["p2_stamina"] = clamp(float(next_state.get("p2_stamina", 100.0)) + recovery, 0.0, 100.0)

    target = int(next_state.get("target_score") or 5)
    next_state["is_terminal"] = (
        int(score.get("p1", 0)) >= target or int(score.get("p2", 0)) >= target
    )

    return next_state, point_winner


def rollout_policy(
    state: Dict,
    *,
    valid_actions: list[str],
    rng: random.Random,
) -> str:
    """Semi-random rollout policy biased by obvious tactical cues."""

    if not valid_actions:
        return "DRIVE"

    player = str(state.get("current_turn", "p1"))
    stamina = float(state.get(f"{player}_stamina", 100.0) or 100.0)
    power = float(state.get(f"{player}_power", 0.0) or 0.0)
    opp = other_player(player)
    opp_stamina = float(state.get(f"{opp}_stamina", 100.0) or 100.0)
    height = float(state.get("shuttle_height", 1.5) or 1.5)
    zone = int(state.get("shuttle_zone", 4) or 4)
    front, back, _ = _zone_flags(zone)

    diff = score_diff(state, player)
    losing = diff < 0

    weights: list[float] = []
    for action in valid_actions:
        w = 1.0
        if action == "SPECIAL" and power >= 60:
            w = 3.0
            if losing:
                w += 1.2
            if opp_stamina <= 45:
                w += 1.0
            if height >= 1.5:
                w += 0.6
        elif action == "SMASH" and stamina >= 60 and height >= 2.0:
            w = 2.0
        elif action in ("DROP_SHOT", "NET_SHOT") and front and stamina < 55:
            w = 1.6
        elif action in ("CLEAR", "LOB") and back and stamina < 45:
            w = 1.5
        elif action == "DRIVE":
            w = 1.2
        weights.append(w)

    total = sum(weights) or 1.0
    r = rng.random() * total
    acc = 0.0
    for action, w in zip(valid_actions, weights):
        acc += w
        if r <= acc:
            return action

    return valid_actions[-1]


def rollout(
    state: Dict,
    *,
    max_depth: int,
    rng: random.Random,
    config: Optional[Dict[str, Any]] = None,
    include_movement_actions: bool = False,
) -> Optional[str]:
    """Run a rollout and return the winning player id ('p1'|'p2') or None."""

    s = clone_state(state)
    cfg = config or {}

    for _ in range(max(1, int(max_depth))):
        if is_terminal(s):
            break

        valid = generate_valid_actions(
            s,
            include_movement_actions=include_movement_actions,
            config=cfg,
        )
        action = rollout_policy(s, valid_actions=valid, rng=rng)
        s, _ = transition(s, action=action, rng=rng, config=cfg)

    return winner_from_state(s)
