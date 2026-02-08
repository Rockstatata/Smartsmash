class GameState:
    def __init__(self):
        # Position information
        self.player_pos = None
        self.opponent_pos = None
        
        # Shuttle information
        self.shuttle_zone = None
        self.shuttle_height = None
        
        # Player stats
        self.stamina = None
        self.power = None
        
        # Game status
        self.score = None
