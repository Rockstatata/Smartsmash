from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Node:
    """A single node in the Monte Carlo search tree.

    Notes
    -----
    The node stores statistics from the perspective of ``player_just_moved``.
    This is the standard trick for two-player UCT: when selecting at a node,
    children correspond to moves by the *current* player, so the child stores
    results for that player and can be maximised directly.
    """

    state: Dict
    parent: Optional[Node] = None
    action: Optional[str] = None
    player_just_moved: Optional[str] = None
    depth: int = 0

    children: Dict[str, Node] = field(default_factory=dict)
    untried_actions: List[str] = field(default_factory=list)

    visits: int = 0
    total_value: float = 0.0

    @property
    def is_root(self) -> bool:
        return self.parent is None

    def is_fully_expanded(self) -> bool:
        return not self.untried_actions

    def add_child(self, action: str, child: Node) -> None:
        self.children[action] = child

    def mean_value(self) -> float:
        if self.visits <= 0:
            return 0.0
        return float(self.total_value) / float(self.visits)
