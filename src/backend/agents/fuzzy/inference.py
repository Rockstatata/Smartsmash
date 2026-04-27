"""Fuzzification + Mamdani inference + intent aggregation.

Pipeline:
    GameState  --(fuzzify_state)-->  fuzzy_values
    fuzzy_values + RULES  --(evaluate_rules)-->  fired rules with strengths
    fired rules  --(aggregate_intents)-->  per-intent set activations
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .membership import (
    OPPONENT_DISTANCE,
    POWER,
    SCORE_DIFF,
    SHUTTLE_DEPTH,
    SHUTTLE_HEIGHT,
    SHUTTLE_LATERAL,
    STAMINA,
    evaluate_variable,
)
from .rules import INTENT_REGISTRY, Rule


# ---------------------------------------------------------------------------
# Helpers for safely extracting fields from a GameState (or dict-like state).
# ---------------------------------------------------------------------------

def _get(state: Any, attr: str, default=None):
    if state is None:
        return default
    if isinstance(state, dict):
        return state.get(attr, default)
    return getattr(state, attr, default)


def _opponent_distance(state: Any) -> float:
    """Euclidean distance between player and opponent in normalised units."""
    pp = _get(state, "player_pos") or {}
    op = _get(state, "opponent_pos") or {}
    try:
        dx = float(op.get("x", 0.5)) - float(pp.get("x", 0.5))
        dy = float(op.get("y", 0.5)) - float(pp.get("y", 0.5))
        return (dx * dx + dy * dy) ** 0.5
    except Exception:
        return 0.5


def _score_diff(state: Any) -> float:
    score = _get(state, "score") or {}
    if not isinstance(score, dict):
        return 0.0
    try:
        return float(score.get("p1", 0)) - float(score.get("p2", 0))
    except Exception:
        return 0.0


def fuzzify_state(state: Any) -> Dict[str, Dict[str, float]]:
    """Convert a GameState into per-variable membership dictionaries."""
    height = _get(state, "shuttle_height", 1.5)
    zone = _get(state, "shuttle_zone", 4)
    stamina = _get(state, "stamina", 100)
    power = _get(state, "power", 0)
    opp_stamina = _get(state, "opponent_stamina", 100)

    return {
        "shuttle_height":    evaluate_variable(height, SHUTTLE_HEIGHT),
        "shuttle_lateral":   evaluate_variable(zone, SHUTTLE_LATERAL),
        "shuttle_depth":     evaluate_variable(zone, SHUTTLE_DEPTH),
        "player_stamina":    evaluate_variable(stamina, STAMINA),
        "opponent_stamina":  evaluate_variable(opp_stamina, STAMINA),
        "player_power":      evaluate_variable(power, POWER),
        "opponent_distance": evaluate_variable(_opponent_distance(state), OPPONENT_DISTANCE),
        "score_diff":        evaluate_variable(_score_diff(state), SCORE_DIFF),
    }


# ---------------------------------------------------------------------------
# Rule evaluation: AND = min, rule strength = min(antecedent memberships).
# ---------------------------------------------------------------------------

def evaluate_rules(
    fuzzy_values: Dict[str, Dict[str, float]],
    rules: List[Rule],
) -> List[Tuple[Rule, float]]:
    """Return [(rule, firing_strength)] for every rule that fires (>0)."""
    fired: List[Tuple[Rule, float]] = []
    for rule in rules:
        strength = 1.0
        for var, set_name in rule.antecedents:
            sets = fuzzy_values.get(var)
            if not sets:
                strength = 0.0
                break
            mu = sets.get(set_name, 0.0)
            if mu < strength:
                strength = mu
            if strength <= 0.0:
                break
        if strength > 0.0:
            fired.append((rule, strength * rule.weight))
    return fired


# ---------------------------------------------------------------------------
# Aggregation: per-intent fuzzy set activations using max (Mamdani).
# ---------------------------------------------------------------------------

def aggregate_intents(
    fired_rules: List[Tuple[Rule, float]],
) -> Dict[str, Dict[str, float]]:
    """Aggregate fired rules into per-intent set activation maps."""
    intents: Dict[str, Dict[str, float]] = {
        intent: {set_name: 0.0 for set_name in sets}
        for intent, sets in INTENT_REGISTRY.items()
    }
    for rule, strength in fired_rules:
        for intent, set_name, contribution in rule.consequents:
            if intent not in intents or set_name not in intents[intent]:
                continue
            activation = strength * contribution
            if activation > intents[intent][set_name]:
                intents[intent][set_name] = activation
    return intents
