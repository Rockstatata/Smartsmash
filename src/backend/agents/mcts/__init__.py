"""Legacy MCTS package.

The production-quality implementation lives in `agents.mcts_agent`.
This package re-exports the new class to remain compatible with older import
paths (e.g. `from agents.mcts import MCTSAgent`).
"""

from .mcts_agent import MCTSAgent

__all__ = ["MCTSAgent"]
