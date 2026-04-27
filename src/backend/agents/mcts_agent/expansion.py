from __future__ import annotations

import random
from typing import Any, Dict, Optional

from .node import Node
from .simulation import is_terminal, transition
from .utils import generate_valid_actions


def expand_once(
    node: Node,
    *,
    rng: random.Random,
    config: Optional[Dict[str, Any]] = None,
    include_movement_actions: bool = False,
) -> Node:
    """Expand one untried action from `node` and return the created child."""

    if not node.untried_actions:
        raise ValueError("Node has no untried actions to expand")

    cfg = config or {}

    action = rng.choice(node.untried_actions)
    node.untried_actions.remove(action)

    actor = str(node.state.get("current_turn", "p1"))
    child_state, _ = transition(node.state, action=action, rng=rng, config=cfg)

    child_untried = (
        []
        if is_terminal(child_state)
        else generate_valid_actions(
            child_state,
            include_movement_actions=include_movement_actions,
            config=cfg,
        )
    )

    child = Node(
        state=child_state,
        parent=node,
        action=action,
        player_just_moved=actor,
        depth=node.depth + 1,
        untried_actions=child_untried,
    )

    node.add_child(action, child)
    return child
