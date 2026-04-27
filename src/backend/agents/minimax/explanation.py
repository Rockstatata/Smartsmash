"""Explanation helpers for minimax decisions."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def _top_contributions(contributions: Dict[str, float], top_n: int = 3) -> List[Tuple[str, float]]:
    ordered = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)
    return ordered[:top_n]


def build_reasoning(features: Dict[str, Any], contributions: Dict[str, float]) -> str:
    """Return a short, formal reasoning statement for the decision."""
    rally_state = features.get("rally_state", "neutral")
    top = _top_contributions(contributions, top_n=3)
    if not top:
        return f"Selected action based on a {rally_state} rally assessment."

    clauses = [
        f"{name.replace('_', ' ')} ({value:+.3f})" for name, value in top
    ]
    joined = "; ".join(clauses)
    return (
        f"Selected action under a {rally_state} rally assessment. "
        f"Primary contributors: {joined}."
    )


def format_explanation(
    *,
    action: str,
    score: float,
    depth: int,
    nodes_explored: int,
    cutoffs: int,
    cache_hits: int,
    features: Dict[str, Any],
    contributions: Dict[str, float],
    top_actions: List[Dict[str, Any]],
    decision_time_ms: float,
+) -> Dict[str, Any]:
    """Return a structured explanation payload for UI and logging."""
    return {
        "action": action,
        "score": round(float(score), 4),
        "depth": int(depth),
        "nodes_explored": int(nodes_explored),
        "cutoffs": int(cutoffs),
        "cache_hits": int(cache_hits),
        "reasoning": build_reasoning(features, contributions),
        "top_actions": top_actions,
        "features": features,
        "contributions": {k: round(float(v), 4) for k, v in contributions.items()},
        "decision_time_ms": round(float(decision_time_ms), 3),
    }
