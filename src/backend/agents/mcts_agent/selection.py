from __future__ import annotations

import math
import random
from typing import Optional

from .node import Node


def uct_score(
    *,
    parent_visits: int,
    child_visits: int,
    child_total_value: float,
    exploration_constant: float,
) -> float:
    """Compute the UCT (Upper Confidence bound applied to Trees) score."""
    if child_visits <= 0:
        return float("inf")

    exploitation = child_total_value / child_visits
    exploration = exploration_constant * math.sqrt(
        math.log(max(1, parent_visits)) / child_visits
    )
    return float(exploitation + exploration)


def select_child_uct(
    node: Node,
    *,
    exploration_constant: float,
    rng: Optional[random.Random] = None,
) -> Node:
    """Select a child node using the UCT policy."""
    if not node.children:
        raise ValueError("Cannot select from a node with no children")

    rng = rng or random.Random()

    best_score = -float("inf")
    best_children: list[Node] = []

    for child in node.children.values():
        score = uct_score(
            parent_visits=node.visits,
            child_visits=child.visits,
            child_total_value=child.total_value,
            exploration_constant=exploration_constant,
        )
        if score > best_score:
            best_score = score
            best_children = [child]
        elif score == best_score:
            best_children.append(child)

    return rng.choice(best_children)
