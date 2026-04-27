"""Legacy compatibility wrapper for the SmartSmash MCTS agent.

The new production implementation lives in `agents.mcts_agent`.
This module remains to avoid breaking existing imports.
"""

from agents.mcts_agent.mcts_agent import MCTSAgent

__all__ = ["MCTSAgent"]
