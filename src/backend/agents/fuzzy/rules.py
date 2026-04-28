"""Rule base for the SmartSmash fuzzy agent.

A rule is a named, weighted Mamdani-style implication. Antecedents are
specified as a list of (variable_name, set_name) pairs combined with AND
(min) by the inference engine. Each rule contributes to one or more
consequent intent buckets (aggression / defense / movement / shot_type)
plus optional direct action votes used during defuzzification.

Keeping rules as data lets us audit, extend, and explain the agent without
touching the inference machinery.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple


# Intent buckets used by the inference engine.
INTENT_AGGRESSION = ("aggression", ("low", "medium", "high"))
INTENT_DEFENSE = ("defense", ("low", "medium", "high"))
INTENT_MOVEMENT = ("movement", ("left", "right", "stay"))
INTENT_SHOT = ("shot_type", ("short", "long", "smash", "special"))

INTENT_REGISTRY: Dict[str, Tuple[str, ...]] = {
    name: sets for name, sets in (INTENT_AGGRESSION, INTENT_DEFENSE, INTENT_MOVEMENT, INTENT_SHOT)
}


@dataclass(frozen=True)
class Rule:
    """A weighted Mamdani rule.

    antecedents: list of (variable, set). All AND-combined via min.
    consequents: list of (intent_variable, intent_set, contribution_weight).
    weight: global rule weight (priority).
    """

    name: str
    antecedents: List[Tuple[str, str]]
    consequents: List[Tuple[str, str, float]]
    weight: float = 1.0
    description: str = ""


# ---------------------------------------------------------------------------
# Rule base. Variable names match those used by inference.fuzzify_state.
# ---------------------------------------------------------------------------
RULES: List[Rule] = [
    # --- Offense: high shuttle + power + opponent far -> smash --------------
    Rule(
        name="R01_high_shuttle_full_power_opponent_far_smash",
        antecedents=[
            ("shuttle_height", "high"),
            ("player_power", "full"),
            ("opponent_distance", "far"),
        ],
        consequents=[
            ("aggression", "high", 1.0),
            ("shot_type", "smash", 1.0),
        ],
        weight=1.2,
        description="Perfect smash window: high shuttle, full power, opponent out of position.",
    ),
    Rule(
        name="R02_high_shuttle_high_stamina_smash",
        antecedents=[
            ("shuttle_height", "high"),
            ("player_stamina", "high"),
        ],
        consequents=[
            ("aggression", "high", 0.8),
            ("shot_type", "smash", 0.8),
        ],
        weight=1.0,
        description="Tall shuttle with stamina to spare favours a smash.",
    ),
    Rule(
        name="R03_medium_shuttle_drive",
        antecedents=[
            ("shuttle_height", "medium"),
            ("player_stamina", "medium"),
        ],
        consequents=[
            ("aggression", "medium", 0.7),
            ("shot_type", "long", 0.6),
        ],
        weight=0.9,
        description="Mid-height shuttle invites a flat drive / long clear.",
    ),

    # --- Defense: low shuttle / low stamina ---------------------------------
    Rule(
        name="R04_low_shuttle_low_stamina_short",
        antecedents=[
            ("shuttle_height", "low"),
            ("player_stamina", "low"),
        ],
        consequents=[
            ("defense", "high", 1.0),
            ("shot_type", "short", 1.0),
        ],
        weight=1.1,
        description="Low and tired: take the shuttle short to recover.",
    ),
    Rule(
        name="R05_low_shuttle_opponent_near_short",
        antecedents=[
            ("shuttle_height", "low"),
            ("opponent_distance", "near"),
        ],
        consequents=[
            ("defense", "medium", 0.6),
            ("shot_type", "short", 0.7),
        ],
        weight=0.9,
        description="Net play with opponent close: short net shot.",
    ),
    Rule(
        name="R06_low_stamina_defensive",
        antecedents=[("player_stamina", "low")],
        consequents=[
            ("defense", "high", 0.8),
            ("aggression", "low", 0.8),
        ],
        weight=1.0,
        description="Low stamina universally pushes us defensive.",
    ),

    # --- Long clears to reset ------------------------------------------------
    Rule(
        name="R07_back_court_high_clear",
        antecedents=[
            ("shuttle_depth", "back"),
            ("shuttle_height", "high"),
        ],
        consequents=[("shot_type", "long", 0.7)],
        weight=0.8,
        description="Back court + height -> deep clear to push opponent back.",
    ),
    Rule(
        name="R08_opponent_far_clear",
        antecedents=[("opponent_distance", "far")],
        consequents=[
            ("shot_type", "long", 0.5),
            ("aggression", "medium", 0.4),
        ],
        weight=0.7,
        description="Opponent far away -> exploit with deep placement.",
    ),

    # --- Special / power-up shots -------------------------------------------
    Rule(
        name="R09_power_full_losing_special",
        antecedents=[
            ("player_power", "full"),
            ("score_diff", "losing"),
        ],
        consequents=[
            ("shot_type", "special", 1.0),
            ("aggression", "high", 0.8),
        ],
        weight=1.3,
        description="Behind on score with a full bar -> spend the special.",
    ),
    Rule(
        name="R10_power_full_opponent_low_stamina_special",
        antecedents=[
            ("player_power", "full"),
            ("opponent_stamina", "low"),
        ],
        consequents=[("shot_type", "special", 0.9)],
        weight=1.1,
        description="Full power vs a tired opponent: cash it in.",
    ),
    Rule(
        name="R10b_power_full_balanced_special",
        antecedents=[
            ("player_power", "full"),
            ("score_diff", "balanced"),
        ],
        consequents=[("shot_type", "special", 0.72)],
        weight=0.95,
        description="At parity with full power, use special at selective windows.",
    ),
    Rule(
        name="R10c_power_charging_losing_special_probe",
        antecedents=[
            ("player_power", "charging"),
            ("score_diff", "losing"),
            ("shuttle_height", "high"),
        ],
        consequents=[("shot_type", "special", 0.58), ("aggression", "high", 0.4)],
        weight=0.9,
        description="When trailing and power is charging, probe with occasional special attempts.",
    ),

    # --- Movement intents ----------------------------------------------------
    Rule(
        name="R11_shuttle_left_move_left",
        antecedents=[("shuttle_lateral", "left")],
        consequents=[("movement", "left", 1.0)],
        weight=1.0,
        description="Track shuttle to the left side.",
    ),
    Rule(
        name="R12_shuttle_right_move_right",
        antecedents=[("shuttle_lateral", "right")],
        consequents=[("movement", "right", 1.0)],
        weight=1.0,
        description="Track shuttle to the right side.",
    ),
    Rule(
        name="R13_shuttle_center_stay",
        antecedents=[("shuttle_lateral", "center")],
        consequents=[("movement", "stay", 0.8)],
        weight=0.8,
        description="Shuttle central: hold position.",
    ),

    # --- Score-driven risk modulation ---------------------------------------
    Rule(
        name="R14_winning_play_safe",
        antecedents=[("score_diff", "winning")],
        consequents=[
            ("aggression", "low", 0.6),
            ("defense", "medium", 0.6),
            ("shot_type", "long", 0.4),
        ],
        weight=0.9,
        description="Ahead: reduce risk, keep rallies alive.",
    ),
    Rule(
        name="R15_losing_take_risks",
        antecedents=[("score_diff", "losing")],
        consequents=[
            ("aggression", "high", 0.7),
            ("shot_type", "smash", 0.4),
        ],
        weight=1.0,
        description="Behind: take more risks to swing rallies.",
    ),
    Rule(
        name="R16_balanced_play_solid",
        antecedents=[("score_diff", "balanced")],
        consequents=[
            ("aggression", "medium", 0.5),
            ("defense", "medium", 0.5),
        ],
        weight=0.6,
        description="Even score: play balanced badminton.",
    ),

    # --- Stamina husbandry ---------------------------------------------------
    Rule(
        name="R17_high_stamina_pressure",
        antecedents=[
            ("player_stamina", "high"),
            ("opponent_stamina", "low"),
        ],
        consequents=[
            ("aggression", "high", 0.9),
            ("shot_type", "smash", 0.5),
        ],
        weight=1.1,
        description="Stamina advantage: pressure the opponent.",
    ),
    Rule(
        name="R18_both_low_stamina_short",
        antecedents=[
            ("player_stamina", "low"),
            ("opponent_stamina", "low"),
        ],
        consequents=[
            ("shot_type", "short", 0.7),
            ("defense", "medium", 0.5),
        ],
        weight=0.8,
        description="Both tired: keep it short, conserve.",
    ),

    # --- Charging power ------------------------------------------------------
    Rule(
        name="R19_power_charging_long",
        antecedents=[
            ("player_power", "charging"),
            ("shuttle_height", "medium"),
        ],
        consequents=[("shot_type", "long", 0.5)],
        weight=0.6,
        description="While charging the bar, prefer safe long shots.",
    ),
    Rule(
        name="R20_power_empty_short",
        antecedents=[
            ("player_power", "empty"),
            ("shuttle_height", "low"),
        ],
        consequents=[
            ("shot_type", "short", 0.6),
            ("defense", "medium", 0.5),
        ],
        weight=0.7,
        description="No power and low shuttle: net work to reset.",
    ),

    # --- Front court attack --------------------------------------------------
    Rule(
        name="R21_front_court_high_smash",
        antecedents=[
            ("shuttle_depth", "front"),
            ("shuttle_height", "high"),
            ("player_stamina", "medium"),
        ],
        consequents=[
            ("aggression", "high", 0.9),
            ("shot_type", "smash", 0.9),
        ],
        weight=1.15,
        description="Front court lift sitting up: punish with a smash.",
    ),

    # --- Opponent close, low shuttle: deceptive net ------------------------
    Rule(
        name="R22_opponent_near_low_shuttle_short",
        antecedents=[
            ("opponent_distance", "near"),
            ("shuttle_height", "low"),
        ],
        consequents=[("shot_type", "short", 0.6)],
        weight=0.7,
        description="Opponent crowding the net: tight short return.",
    ),
]


def get_rules() -> List[Rule]:
    """Return the active rule base (defensive copy of the module-level list)."""
    return list(RULES)
