"""Defuzzification: turn aggregated intent activations into a discrete action.

Approach: weighted scoring per candidate action. Each action's score is
derived from the relevant intent activations (shot type + aggression / defense
modifiers) plus a movement override that can be returned as a movement action
when no shot is clearly preferred.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

# Concrete action vocabulary used by the rest of the system. Mirrors the
# strings produced by api/server.py's step endpoint plus PRD movement /
# special intents so callers can use either set.
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

# How much each shot-type intent contributes to each concrete action.
# (intent_set -> {action: weight})
SHOT_INTENT_TO_ACTION: Dict[str, Dict[str, float]] = {
    "smash":   {"SMASH": 1.0, "DRIVE": 0.3},
    "long":    {"CLEAR": 1.0, "LOB": 0.7, "DRIVE": 0.4},
    "short":   {"DROP_SHOT": 1.0, "NET_SHOT": 0.9},
    "special": {"SPECIAL": 1.25, "SMASH": 0.25},
}

# Aggression modulates aggressive shots; defense modulates defensive shots.
AGGRESSIVE_ACTIONS = {"SMASH": 1.0, "DRIVE": 0.6, "SPECIAL": 0.9}
DEFENSIVE_ACTIONS = {"DROP_SHOT": 1.0, "NET_SHOT": 0.8, "LOB": 0.6, "CLEAR": 0.5}


def score_actions(intents: Dict[str, Dict[str, float]]) -> Dict[str, float]:
    """Score each concrete action from aggregated intent activations."""
    scores: Dict[str, float] = {a: 0.0 for a in ALL_ACTIONS}

    shot = intents.get("shot_type", {})
    for set_name, mu in shot.items():
        if mu <= 0.0:
            continue
        for action, w in SHOT_INTENT_TO_ACTION.get(set_name, {}).items():
            scores[action] += mu * w

    aggression = intents.get("aggression", {})
    agg_level = (
        0.25 * aggression.get("low", 0.0)
        + 0.6 * aggression.get("medium", 0.0)
        + 1.0 * aggression.get("high", 0.0)
    )
    for action, w in AGGRESSIVE_ACTIONS.items():
        scores[action] += 0.4 * agg_level * w

    defense = intents.get("defense", {})
    def_level = (
        0.25 * defense.get("low", 0.0)
        + 0.6 * defense.get("medium", 0.0)
        + 1.0 * defense.get("high", 0.0)
    )
    for action, w in DEFENSIVE_ACTIONS.items():
        scores[action] += 0.4 * def_level * w

    movement = intents.get("movement", {})
    scores["MOVE_LEFT"] += movement.get("left", 0.0)
    scores["MOVE_RIGHT"] += movement.get("right", 0.0)
    scores["STAY"] += movement.get("stay", 0.0)

    # Tactical nudge: when special intent is materially active,
    # reduce over-conservative collapse into generic shots.
    special_intent = float(shot.get("special", 0.0))
    if special_intent >= 0.45:
        scores["SPECIAL"] += 0.22 * special_intent

    return scores


def select_action(
    intents: Dict[str, Dict[str, float]],
    *,
    valid_actions: Tuple[str, ...] = SHOT_ACTIONS,
) -> Tuple[str, float, Dict[str, float]]:
    """Return (action, confidence, all_scores).

    Defaults to picking from SHOT_ACTIONS so the agent always returns a
    rally-relevant action. Pass ``valid_actions=ALL_ACTIONS`` if movement
    intents should be considered as primary outputs.
    """
    scores = score_actions(intents)
    candidates: List[Tuple[str, float]] = [
        (a, scores.get(a, 0.0)) for a in valid_actions
    ]
    candidates.sort(key=lambda kv: kv[1], reverse=True)

    best_action, best_score = candidates[0]
    if best_score <= 0.0:
        # Safe fallback when no rule fires meaningfully.
        best_action, best_score = "DRIVE", 0.0

    total = sum(max(0.0, s) for _, s in candidates) or 1.0
    confidence = max(0.0, best_score) / total
    return best_action, float(confidence), scores
