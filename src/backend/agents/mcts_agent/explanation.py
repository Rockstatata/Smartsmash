from __future__ import annotations

from typing import Any, Dict, List, Optional

from .node import Node
from .utils import iter_child_stats


def format_explanation(
    *,
    action: str,
    root: Node,
    simulations: int,
    tree_depth: int,
    decision_time_ms: float,
) -> Dict[str, Any]:
    """Build the PRD-required explainability payload."""

    children = iter_child_stats(root.children.items())
    children.sort(key=lambda r: (r["visits"], r["win_rate"]), reverse=True)

    best = next((row for row in children if row["action"] == action), None)
    best_visits = int(best["visits"]) if best else 0
    best_win_rate = float(best["win_rate"]) if best else 0.0

    total_child_visits = sum(int(row["visits"]) for row in children) or 1
    confidence = best_visits / total_child_visits

    top_snippets: List[str] = []
    for row in children[:3]:
        top_snippets.append(
            f"{row['action']} (N={row['visits']}, win_rate={row['win_rate']:.2f})"
        )

    if top_snippets:
        reasoning = (
            f"Selected {action} because it received the most search support "
            f"(N={best_visits}/{total_child_visits}) with estimated win_rate={best_win_rate:.2f}. "
            f"Top actions: {', '.join(top_snippets)}."
        )
    else:
        reasoning = f"Selected {action} as a safe default — no rollouts completed."

    return {
        "action": action,
        "confidence": round(float(confidence), 4),
        "simulations": int(simulations),
        "win_rate": round(float(best_win_rate), 4),
        "tree_depth": int(tree_depth),
        "reasoning": reasoning,
        "decision_time_ms": round(float(decision_time_ms), 3),
        "root_visits": int(root.visits),
        "action_stats": children,
    }
