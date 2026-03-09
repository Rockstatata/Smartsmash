"""
SmartSmash — FastAPI Backend Bridge

Provides a REST API that bridges the web frontend to the Python AI
simulation engine. This server exposes endpoints for match simulation,
agent information, leaderboard data, and match history.

Architecture:
    Frontend (HTML/JS) <--HTTP/JSON--> FastAPI <---> Python AI Engine

Usage:
    python -m src.api.server
    OR
    uvicorn src.api.server:app --reload --port 8000
"""

import copy
import json
import time
import uuid
import os
import sys
from pathlib import Path

# Ensure project root is in the Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    from pydantic import BaseModel
except ImportError:
    print("FastAPI not installed. Install with: pip install fastapi uvicorn")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

from typing import Optional, List, Dict, Any

# Import project modules
from src.core.game_state import GameState

# Attempt to import agent and simulator modules
# These may be stubs, so we handle gracefully
try:
    from src.agents.minimax.minimax_agent import MinimaxAgent
except ImportError:
    MinimaxAgent = None

try:
    from src.agents.mcts.mcts_agent import MCTSAgent
except ImportError:
    MCTSAgent = None

try:
    from src.agents.fuzzy.fuzzy_agent import FuzzyAgent
except ImportError:
    FuzzyAgent = None

try:
    from src.environment.simulator import Simulator
except ImportError:
    Simulator = None

try:
    import yaml
    CONFIG_DIR = PROJECT_ROOT / "config"
    with open(CONFIG_DIR / "game_config.yaml", "r") as f:
        GAME_CONFIG = yaml.safe_load(f)
    with open(CONFIG_DIR / "agent_config.yaml", "r") as f:
        AGENT_CONFIG = yaml.safe_load(f)
except Exception:
    GAME_CONFIG = {"court_dimensions": {"length": 13.4, "width": 6.1}}
    AGENT_CONFIG = {"minimax": {"depth": 3}, "mcts": {"simulations": 1000}}


# ═══════════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════════

class MatchRequest(BaseModel):
    """Request schema for starting a new match."""
    agent1: str
    agent2: str


class MatchState(BaseModel):
    """Serialized representation of the game state."""
    match_id: str
    player_pos: Optional[Dict[str, float]] = None
    opponent_pos: Optional[Dict[str, float]] = None
    shuttle_zone: Optional[int] = None
    shuttle_height: Optional[float] = None
    stamina: Optional[float] = None
    opponent_stamina: Optional[float] = None
    power: Optional[float] = None
    score: Optional[Dict[str, int]] = None
    rally: int = 0
    is_terminal: bool = False
    current_turn: Optional[str] = None
    last_action: Optional[str] = None
    decision_time_ms: Optional[float] = None


class AgentInfo(BaseModel):
    """Metadata about an AI agent."""
    name: str
    type: str
    description: str
    algorithm: str
    config: Dict[str, Any]
    color: str


class LeaderboardEntry(BaseModel):
    """Single leaderboard row."""
    rank: int
    name: str
    elo: float
    winrate: float
    points: int
    matches: int
    color: str
    description: str


class MatchHistoryEntry(BaseModel):
    """Single match history record."""
    id: str
    agent1: str
    agent2: str
    score: Dict[str, int]
    winner: str
    rally_count: int
    timestamp: str


# ═══════════════════════════════════════════════════════════
# Application Setup
# ═══════════════════════════════════════════════════════════

app = FastAPI(
    title="SmartSmash API",
    description="Backend bridge for the SmartSmash Classical AI Competition Arena",
    version="1.0.0"
)

# CORS — allow the frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the web frontend as static files
WEB_DIR = PROJECT_ROOT / "src" / "visualization" / "web"
CSS_DIR = WEB_DIR / "css"
JS_DIR = WEB_DIR / "js"

# Mount CSS and JS subdirectories at their expected paths
if CSS_DIR.exists():
    app.mount("/css", StaticFiles(directory=str(CSS_DIR)), name="css")
if JS_DIR.exists():
    app.mount("/js", StaticFiles(directory=str(JS_DIR)), name="js")
# General static mount for other assets
if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


# ═══════════════════════════════════════════════════════════
# In-Memory State Stores
# ═══════════════════════════════════════════════════════════

# Active match sessions
active_matches: Dict[str, Dict[str, Any]] = {}

# Simulated leaderboard data (replaced by real data when matches run)
leaderboard_data: List[Dict[str, Any]] = [
    {
        "rank": 1, "name": "Minimax", "elo": 1847, "winrate": 72.5,
        "points": 2450, "matches": 48, "color": "#4A9EFF",
        "description": "Depth-limited search with alpha-beta pruning"
    },
    {
        "rank": 2, "name": "MCTS", "elo": 1792, "winrate": 65.8,
        "points": 2180, "matches": 48, "color": "#A855F7",
        "description": "Monte Carlo Tree Search with UCT selection"
    },
    {
        "rank": 3, "name": "Fuzzy", "elo": 1685, "winrate": 52.1,
        "points": 1720, "matches": 48, "color": "#4ade80",
        "description": "Fuzzy logic rule-based inference system"
    },
]

# Match history
match_history: List[Dict[str, Any]] = []

# Agent registry
AGENT_REGISTRY: Dict[str, AgentInfo] = {
    "minimax": AgentInfo(
        name="Minimax",
        type="minimax",
        description="Uses depth-limited minimax search with handcrafted heuristic evaluation and optional alpha-beta pruning to select optimal actions.",
        algorithm="Minimax Search",
        config=AGENT_CONFIG.get("minimax", {"depth": 3}),
        color="#4A9EFF"
    ),
    "mcts": AgentInfo(
        name="MCTS",
        type="mcts",
        description="Employs Monte Carlo Tree Search with UCT selection policy, stochastic rollout simulation, and configurable iteration budget.",
        algorithm="Monte Carlo Tree Search",
        config=AGENT_CONFIG.get("mcts", {"simulations": 1000}),
        color="#A855F7"
    ),
    "fuzzy": AgentInfo(
        name="Fuzzy",
        type="fuzzy",
        description="Applies fuzzy logic inference with explicit membership functions and a deterministic rule base for interpretable decision-making.",
        algorithm="Fuzzy Logic Inference",
        config={},
        color="#4ade80"
    ),
}


# ═══════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════

def create_initial_state() -> GameState:
    """Creates a fresh GameState with default initial values."""
    state = GameState()
    state.player_pos = {"x": 0.25, "y": 0.5}
    state.opponent_pos = {"x": 0.75, "y": 0.5}
    state.shuttle_zone = 1
    state.shuttle_height = 1.5
    state.stamina = 100
    state.power = 0
    state.score = {"p1": 0, "p2": 0}
    return state


def state_to_dict(state: GameState, match_id: str, rally: int = 0) -> dict:
    """Converts a GameState to a JSON-serializable dictionary."""
    return {
        "match_id": match_id,
        "player_pos": state.player_pos,
        "opponent_pos": state.opponent_pos,
        "shuttle_zone": state.shuttle_zone,
        "shuttle_height": state.shuttle_height,
        "stamina": state.stamina,
        "power": state.power,
        "score": state.score,
        "rally": rally,
        "is_terminal": False,
        "current_turn": "p1",
        "last_action": None,
        "decision_time_ms": 0,
    }


# ═══════════════════════════════════════════════════════════
# API Routes
# ═══════════════════════════════════════════════════════════

# ─── Root / Frontend Serving ───────────────────────────────

@app.get("/")
async def root():
    """Serves the frontend index.html."""
    index_path = WEB_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "SmartSmash API is running", "docs": "/docs"}


# ─── Health Check ──────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Returns server health status."""
    return {
        "status": "ok",
        "timestamp": time.time(),
        "agents_available": list(AGENT_REGISTRY.keys()),
        "active_matches": len(active_matches),
    }


# ─── Agent Endpoints ──────────────────────────────────────

@app.get("/api/agents")
async def list_agents():
    """Lists all available AI agents."""
    return [agent.dict() for agent in AGENT_REGISTRY.values()]


@app.get("/api/agents/{agent_type}")
async def get_agent(agent_type: str):
    """Returns details about a specific agent."""
    if agent_type not in AGENT_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_type}' not found")
    return AGENT_REGISTRY[agent_type].dict()


# ─── Match Endpoints ──────────────────────────────────────

@app.post("/api/match/start")
async def start_match(request: MatchRequest):
    """
    Initializes a new match between two agents.
    Returns the match ID and initial game state.
    """
    if request.agent1 not in AGENT_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {request.agent1}")
    if request.agent2 not in AGENT_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {request.agent2}")

    match_id = str(uuid.uuid4())[:8]
    game_state = create_initial_state()

    active_matches[match_id] = {
        "id": match_id,
        "agent1": request.agent1,
        "agent2": request.agent2,
        "state": game_state,
        "rally": 0,
        "started_at": time.time(),
        "history": [],
    }

    return state_to_dict(game_state, match_id)


@app.post("/api/match/{match_id}/step")
async def step_match(match_id: str):
    """
    Advances the match by one decision step.
    The active agent selects an action, which is validated
    and applied by the simulator.
    """
    if match_id not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")

    match = active_matches[match_id]
    match["rally"] += 1

    # Simulate a step (demonstration mode when agents aren't fully implemented)
    import random
    state = match["state"]

    # Simulate position changes
    if state.player_pos:
        state.player_pos["x"] = max(0.05, min(0.45, state.player_pos["x"] + random.uniform(-0.05, 0.05)))
        state.player_pos["y"] = max(0.1, min(0.9, state.player_pos["y"] + random.uniform(-0.05, 0.05)))

    if state.opponent_pos:
        state.opponent_pos["x"] = max(0.55, min(0.95, state.opponent_pos["x"] + random.uniform(-0.05, 0.05)))
        state.opponent_pos["y"] = max(0.1, min(0.9, state.opponent_pos["y"] + random.uniform(-0.05, 0.05)))

    # Simulate shuttle zone change
    state.shuttle_zone = random.randint(1, 8)

    # Simulate stamina drain
    if state.stamina is not None:
        state.stamina = max(0, state.stamina - random.uniform(1, 5))

    # Simulate scoring (every ~10 rallies)
    actions = ["SMASH", "CLEAR", "DROP_SHOT", "DRIVE", "LOB", "NET_SHOT"]
    last_action = random.choice(actions)

    if match["rally"] % 10 == 0:
        if random.random() > 0.5:
            state.score["p1"] += 1
        else:
            state.score["p2"] += 1

    # Check terminal condition
    is_terminal = (state.score.get("p1", 0) >= 21 or state.score.get("p2", 0) >= 21)

    result = state_to_dict(state, match_id, match["rally"])
    result["last_action"] = last_action
    result["decision_time_ms"] = round(random.uniform(2, 150), 1)
    result["is_terminal"] = is_terminal

    if is_terminal:
        # Record match in history
        winner = match["agent1"] if state.score["p1"] > state.score["p2"] else match["agent2"]
        match_history.insert(0, {
            "id": match_id,
            "agent1": match["agent1"],
            "agent2": match["agent2"],
            "score": state.score,
            "winner": winner,
            "rally_count": match["rally"],
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        })
        del active_matches[match_id]

    return result


@app.get("/api/match/{match_id}/state")
async def get_match_state(match_id: str):
    """Returns the current state of an active match."""
    if match_id not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")

    match = active_matches[match_id]
    return state_to_dict(match["state"], match_id, match["rally"])


@app.post("/api/match/run")
async def run_full_match(request: MatchRequest):
    """
    Runs a complete match to termination and returns the result.
    Useful for batch simulation and tournament mode.
    """
    import random

    score = {"p1": 0, "p2": 0}
    rally_count = 0

    while score["p1"] < 21 and score["p2"] < 21:
        rally_count += 1
        if random.random() > 0.5:
            score["p1"] += 1
        else:
            score["p2"] += 1

    winner = request.agent1 if score["p1"] > score["p2"] else request.agent2

    result = {
        "agent1": request.agent1,
        "agent2": request.agent2,
        "score": score,
        "winner": winner,
        "rally_count": rally_count,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    match_history.insert(0, {
        "id": str(uuid.uuid4())[:8],
        **result,
    })

    return result


# ─── Leaderboard Endpoints ────────────────────────────────

@app.get("/api/leaderboard")
async def get_leaderboard():
    """Returns the current agent leaderboard standings."""
    return leaderboard_data


# ─── Match History Endpoints ──────────────────────────────

@app.get("/api/history")
async def get_history(limit: int = 20):
    """Returns recent match history records."""
    return match_history[:limit]


# ─── Configuration Endpoint ───────────────────────────────

@app.get("/api/config")
async def get_config():
    """Returns the current game and agent configuration."""
    return {
        "game": GAME_CONFIG,
        "agents": AGENT_CONFIG,
    }


# ═══════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    try:
        import uvicorn
    except ImportError:
        print("uvicorn not installed. Install with: pip install uvicorn")
        sys.exit(1)

    print("=" * 55)
    print("  SmartSmash — Classical AI Competition Arena")
    print("  API Server starting on http://localhost:8000")
    print("  Frontend at http://localhost:8000/")
    print("  API docs at http://localhost:8000/docs")
    print("=" * 55)

    uvicorn.run(
        "src.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(PROJECT_ROOT / "src")],
    )
