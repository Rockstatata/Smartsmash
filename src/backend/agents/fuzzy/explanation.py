"""Build human-readable explanations for a fuzzy decision."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .rules import Rule


def _dominant_set(memberships: Dict[str, float]) -> Tuple[str, float]:
    if not memberships:
        return ("none", 0.0)
    name, mu = max(memberships.items(), key=lambda kv: kv[1])
    return name, float(mu)


def summarise_fuzzy_values(fuzzy_values: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
    """Compact view: dominant linguistic value per variable."""
    out: Dict[str, Any] = {}
    for var, sets in fuzzy_values.items():
        name, mu = _dominant_set(sets)
        out[var] = {"label": name, "degree": round(mu, 3)}
    return out


def build_reasoning(
    action: str,
    fired_rules: List[Tuple[Rule, float]],
    fuzzy_values: Dict[str, Dict[str, float]],
    top_n: int = 3,
) -> str:
    """Render a one-paragraph natural-language justification."""
    summary = summarise_fuzzy_values(fuzzy_values)
    context_bits = [
        f"shuttle {summary.get('shuttle_height', {}).get('label', '?')}",
        f"stamina {summary.get('player_stamina', {}).get('label', '?')}",
        f"power {summary.get('player_power', {}).get('label', '?')}",
        f"opponent {summary.get('opponent_distance', {}).get('label', '?')}",
        f"score {summary.get('score_diff', {}).get('label', '?')}",
    ]
    context = ", ".join(context_bits)

    if not fired_rules:
        return f"Chose {action} as a default — no fuzzy rule fired strongly. Context: {context}."

    top = sorted(fired_rules, key=lambda kv: kv[1], reverse=True)[:top_n]
    triggers = "; ".join(
        f"{rule.name} (strength {round(strength, 3)})"
        for rule, strength in top
    )
    return (
        f"Chose {action} because: {triggers}. "
        f"Context: {context}."
    )


def format_explanation(
    action: str,
    confidence: float,
    fired_rules: List[Tuple[Rule, float]],
    fuzzy_values: Dict[str, Dict[str, float]],
    scores: Dict[str, float],
) -> Dict[str, Any]:
    """Structured payload returned alongside the chosen action."""
    triggered = [
        {
            "name": rule.name,
            "strength": round(float(strength), 4),
            "description": rule.description,
        }
        for rule, strength in sorted(fired_rules, key=lambda kv: kv[1], reverse=True)
    ]
    return {
        "action": action,
        "confidence": round(float(confidence), 4),
        "triggered_rules": triggered,
        "reasoning": build_reasoning(action, fired_rules, fuzzy_values),
        "fuzzy_values": summarise_fuzzy_values(fuzzy_values),
        "raw_memberships": {
            var: {k: round(v, 4) for k, v in sets.items()}
            for var, sets in fuzzy_values.items()
        },
        "action_scores": {a: round(float(s), 4) for a, s in scores.items()},
    }
