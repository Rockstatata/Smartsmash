class BaseAgent:
    def select_action(self, state):
        """
        Determines the best action given the current game state.
        Must be implemented by subclasses.
        """
        raise NotImplementedError
