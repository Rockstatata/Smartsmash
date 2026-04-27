from __future__ import annotations

from typing import Optional

from .node import Node


def backpropagate(node: Node, winner: Optional[str]) -> None:
    """Backpropagate a rollout result up to the root.

    Parameters
    ----------
    winner:
        'p1' or 'p2' when a winner exists, else None for a draw / undecided.

    Notes
    -----
    Each node tracks value for `player_just_moved`. For binary outcomes:
        value += 1 if player_just_moved == winner else 0
        value += 0.5 for draws
    """

    current: Optional[Node] = node
    while current is not None:
        current.visits += 1

        if winner is None:
            current.total_value += 0.5
        elif current.player_just_moved is not None and current.player_just_moved == winner:
            current.total_value += 1.0
        else:
            current.total_value += 0.0

        current = current.parent
