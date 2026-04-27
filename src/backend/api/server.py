"""
SmartSmash - FastAPI Backend Bridge with Supabase Integration

This server exposes game simulation endpoints and Supabase-backed
services for authentication, database operations, and storage.
"""

from __future__ import annotations

import os
import random
import sys
import time
import uuid
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase import Client, create_client

# Ensure backend package folders are importable.
BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.game_state import GameState

try:
    import yaml
except Exception:  # pragma: no cover
    yaml = None

load_dotenv(BACKEND_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DEMO_AUTH_FALLBACK_ENABLED = os.getenv("DEMO_AUTH_FALLBACK", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
CORS_ORIGINS_RAW = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
)

supabase_public: Optional[Client] = None
supabase_admin: Optional[Client] = None
if SUPABASE_URL and SUPABASE_ANON_KEY:
    supabase_public = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _model_dump(model: BaseModel) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


# ============================
# Pydantic Schemas
# ============================


class MatchRequest(BaseModel):
    agent1: str
    agent2: str


class MatchState(BaseModel):
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
    name: str
    type: str
    description: str
    algorithm: str
    config: Dict[str, Any]
    color: str


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(default=None, min_length=2, max_length=30)
    avatar_url: Optional[str] = None


class StorageDeleteRequest(BaseModel):
    bucket: str
    path: str


class SignInRequest(BaseModel):
    email: str
    password: str


class SignUpRequest(BaseModel):
    email: str
    password: str
    username: Optional[str] = Field(default=None, min_length=2, max_length=30)


# ============================
# Application Setup
# ============================

app = FastAPI(
    title="SmartSmash API",
    description="Backend bridge for SmartSmash with Supabase integration",
    version="2.0.0",
)


def _parse_cors_origins(raw_value: str) -> List[str]:
    value = (raw_value or "").strip()
    if not value:
        return []

    # Support both CSV and JSON array input formats.
    if value.startswith("["):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass

    return [origin.strip() for origin in value.split(",") if origin.strip()]


cors_origins = _parse_cors_origins(CORS_ORIGINS_RAW)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



security = HTTPBearer(auto_error=False)

CONFIG_DIR = BACKEND_DIR / "config"
if yaml and (CONFIG_DIR / "game_config.yaml").exists() and (CONFIG_DIR / "agent_config.yaml").exists():
    with open(CONFIG_DIR / "game_config.yaml", "r", encoding="utf-8") as f:
        GAME_CONFIG = yaml.safe_load(f)
    with open(CONFIG_DIR / "agent_config.yaml", "r", encoding="utf-8") as f:
        AGENT_CONFIG = yaml.safe_load(f)
else:
    GAME_CONFIG = {"court_dimensions": {"length": 13.4, "width": 6.1}}
    AGENT_CONFIG = {"minimax": {"depth": 3}, "mcts": {"simulations": 1000}}


# ============================
# In-Memory Fallback State
# ============================

active_matches: Dict[str, Dict[str, Any]] = {}

leaderboard_data: List[Dict[str, Any]] = [
    {
        "rank": 1,
        "name": "Minimax",
        "elo": 1847,
        "winrate": 72.5,
        "points": 2450,
        "matches": 48,
        "color": "#4A9EFF",
        "description": "Depth-limited search with alpha-beta pruning",
    },
    {
        "rank": 2,
        "name": "MCTS",
        "elo": 1792,
        "winrate": 65.8,
        "points": 2180,
        "matches": 48,
        "color": "#A855F7",
        "description": "Monte Carlo Tree Search with UCT selection",
    },
    {
        "rank": 3,
        "name": "Fuzzy",
        "elo": 1685,
        "winrate": 52.1,
        "points": 1720,
        "matches": 48,
        "color": "#4ade80",
        "description": "Fuzzy logic rule-based inference system",
    },
]

match_history: List[Dict[str, Any]] = []

AGENT_REGISTRY: Dict[str, AgentInfo] = {
    "minimax": AgentInfo(
        name="Minimax",
        type="minimax",
        description="Depth-limited minimax with alpha-beta pruning.",
        algorithm="Minimax Search",
        config=AGENT_CONFIG.get("minimax", {"depth": 3}),
        color="#4A9EFF",
    ),
    "mcts": AgentInfo(
        name="MCTS",
        type="mcts",
        description="Monte Carlo Tree Search with UCT selection.",
        algorithm="Monte Carlo Tree Search",
        config=AGENT_CONFIG.get("mcts", {"simulations": 1000}),
        color="#A855F7",
    ),
    "fuzzy": AgentInfo(
        name="Fuzzy",
        type="fuzzy",
        description="Fuzzy logic rule-based inference system.",
        algorithm="Fuzzy Logic Inference",
        config={},
        color="#4ade80",
    ),
}


# ============================
# Auth / Supabase Helpers
# ============================


def _require_supabase_public() -> Client:
    if not supabase_public:
        raise HTTPException(status_code=503, detail="Supabase public client is not configured")
    return supabase_public


def _require_supabase_admin() -> Client:
    if not supabase_admin:
        raise HTTPException(status_code=503, detail="Supabase admin client is not configured")
    return supabase_admin


def _is_supabase_network_error(exc: Exception) -> bool:
    message = str(exc).lower()
    markers = (
        "getaddrinfo failed",
        "name or service not known",
        "temporary failure in name resolution",
        "failed to resolve",
        "connection refused",
        "timed out",
        "network is unreachable",
    )
    return any(marker in message for marker in markers)


def _is_invalid_credentials_error(exc: Exception) -> bool:
    message = str(exc).lower()
    markers = (
        "invalid login credentials",
        "invalid credentials",
        "email not confirmed",
    )
    return any(marker in message for marker in markers)


demo_auth_sessions: Dict[str, Dict[str, Any]] = {}


def _build_demo_auth_response(email: str, preferred_username: Optional[str] = None) -> Dict[str, Any]:
    safe_email = (email or "").strip() or f"demo_{uuid.uuid4().hex[:6]}@local.smartsmash"
    username = _derive_username(safe_email, {}, preferred_username)
    user_id = f"demo-{uuid.uuid4().hex[:12]}"
    access_token = f"demo.{uuid.uuid4().hex}"

    user_payload = {
        "id": user_id,
        "email": safe_email,
        "metadata": {
            "username": username,
            "auth_mode": "demo",
        },
    }
    profile_payload = {
        "id": user_id,
        "username": username,
        "avatar_url": None,
        "created_at": None,
        "updated_at": None,
    }

    demo_auth_sessions[access_token] = user_payload

    return {
        "user": user_payload,
        "profile": profile_payload,
        "session": {
            "access_token": access_token,
            "refresh_token": None,
            "expires_in": 86400,
        },
        "mode": "demo",
    }


def _extract_user(credentials: Optional[HTTPAuthorizationCredentials]) -> Dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = credentials.credentials
    demo_user = demo_auth_sessions.get(token)
    if demo_user:
        return demo_user

    client = _require_supabase_public()
    try:
        auth_response = client.auth.get_user(token)
        user = getattr(auth_response, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid auth token")
        return {
            "id": getattr(user, "id", None),
            "email": getattr(user, "email", None),
            "raw": user,
            "metadata": getattr(user, "user_metadata", {}) or {},
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Failed to validate token: {exc}") from exc


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    return _extract_user(credentials)


def _fetch_leaderboard_from_db() -> Optional[List[Dict[str, Any]]]:
    if not supabase_admin:
        return None
    try:
        response = (
            supabase_admin.table("leaderboard")
            .select("name, elo, winrate, points, matches, color, description")
            .order("elo", desc=True)
            .execute()
        )
        rows = response.data or []
        output = []
        for idx, row in enumerate(rows, start=1):
            output.append(
                {
                    "rank": idx,
                    "name": row.get("name", "Unknown"),
                    "elo": float(row.get("elo", 0)),
                    "winrate": float(row.get("winrate", 0)),
                    "points": int(row.get("points", 0)),
                    "matches": int(row.get("matches", 0)),
                    "color": row.get("color", "#4A9EFF"),
                    "description": row.get("description", ""),
                }
            )
        return output
    except Exception:
        return None


def _fetch_history_from_db(limit: int) -> Optional[List[Dict[str, Any]]]:
    if not supabase_admin:
        return None
    try:
        response = (
            supabase_admin.table("match_history")
            .select("id, agent1, agent2, score, winner, rally_count, timestamp")
            .order("timestamp", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception:
        return None


def _persist_match_history(record: Dict[str, Any]) -> None:
    if not supabase_admin:
        return
    try:
        supabase_admin.table("match_history").insert(record).execute()
    except Exception:
        # Keep API resilient even if db table does not exist yet.
        pass


def _derive_username(
    email: Optional[str],
    metadata: Optional[Dict[str, Any]],
    preferred_username: Optional[str] = None,
) -> str:
    if preferred_username and preferred_username.strip():
        return preferred_username.strip()[:30]

    if metadata:
        candidate = metadata.get("username")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()[:30]

    if isinstance(email, str) and "@" in email:
        return email.split("@")[0][:30]

    return "challenger"


def _upsert_profile_from_auth_user(
    *,
    user_id: Optional[str],
    email: Optional[str],
    metadata: Optional[Dict[str, Any]],
    preferred_username: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not user_id or not supabase_admin:
        return None

    payload = {
        "id": user_id,
        "username": _derive_username(email, metadata, preferred_username),
        "avatar_url": (metadata or {}).get("avatar_url"),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    try:
        response = supabase_admin.table("profiles").upsert(payload).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
    except Exception:
        # Keep auth flow resilient even if profile sync fails.
        return None

    return payload


# ============================
# Game Helpers
# ============================


def create_initial_state() -> GameState:
    state = GameState()
    state.player_pos = {"x": 0.25, "y": 0.5}
    state.opponent_pos = {"x": 0.75, "y": 0.5}
    state.shuttle_zone = 1
    state.shuttle_height = 1.5
    state.stamina = 100
    state.power = 0
    state.score = {"p1": 0, "p2": 0}
    return state


def state_to_dict(state: GameState, match_id: str, rally: int = 0) -> Dict[str, Any]:
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


# ============================
# Routes
# ============================


@app.get("/")
async def root() -> Dict[str, Any]:
    # Keep a root endpoint for quick status checks.
    return {"message": "SmartSmash API is running", "docs": "/docs"}


@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    supabase_status = "configured" if supabase_public else "missing_env"
    if supabase_public:
        try:
            supabase_public.table("leaderboard").select("name").limit(1).execute()
            supabase_status = "connected"
        except Exception:
            supabase_status = "configured_but_unreachable_or_missing_tables"

    return {
        "status": "ok",
        "timestamp": time.time(),
        "agents_available": list(AGENT_REGISTRY.keys()),
        "active_matches": len(active_matches),
        "supabase": {
            "url_configured": bool(SUPABASE_URL),
            "anon_key_configured": bool(SUPABASE_ANON_KEY),
            "service_role_configured": bool(SUPABASE_SERVICE_ROLE_KEY),
            "status": supabase_status,
        },
        "demo_auth_fallback_enabled": DEMO_AUTH_FALLBACK_ENABLED,
    }


@app.post("/api/auth/sign-up")
async def sign_up(payload: SignUpRequest) -> Dict[str, Any]:
    client = _require_supabase_public()
    try:
        options: Dict[str, Any] = {}
        if payload.username:
            options["data"] = {"username": payload.username}

        sign_up_payload: Dict[str, Any] = {
            "email": payload.email,
            "password": payload.password,
        }
        if options:
            sign_up_payload["options"] = options

        response = client.auth.sign_up(sign_up_payload)
        session = getattr(response, "session", None)
        user = getattr(response, "user", None)
        user_id = getattr(user, "id", None)
        user_email = getattr(user, "email", None)
        user_metadata = getattr(user, "user_metadata", {}) if user else {}
        profile = _upsert_profile_from_auth_user(
            user_id=user_id,
            email=user_email,
            metadata=user_metadata,
            preferred_username=payload.username,
        )
        return {
            "user": {
                "id": user_id,
                "email": user_email,
                "metadata": user_metadata,
            },
            "profile": profile,
            "session": {
                "access_token": getattr(session, "access_token", None),
                "refresh_token": getattr(session, "refresh_token", None),
                "expires_in": getattr(session, "expires_in", None),
            } if session else None,
            "email_confirmation_required": session is None,
        }
    except Exception as exc:
        if _is_supabase_network_error(exc):
            if DEMO_AUTH_FALLBACK_ENABLED:
                return {
                    **_build_demo_auth_response(payload.email, payload.username),
                    "email_confirmation_required": False,
                }
            raise HTTPException(
                status_code=503,
                detail="Authentication service is unreachable. Check SUPABASE_URL and network connectivity.",
            ) from exc
        raise HTTPException(status_code=400, detail=f"Sign up failed: {exc}") from exc


@app.post("/api/auth/sign-in")
async def sign_in(payload: SignInRequest) -> Dict[str, Any]:
    client = _require_supabase_public()
    try:
        response = client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
        session = getattr(response, "session", None)
        user = getattr(response, "user", None)
        if not session or not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user_id = getattr(user, "id", None)
        user_email = getattr(user, "email", None)
        user_metadata = getattr(user, "user_metadata", {}) if user else {}
        profile = _upsert_profile_from_auth_user(
            user_id=user_id,
            email=user_email,
            metadata=user_metadata,
        )
        return {
            "user": {
                "id": user_id,
                "email": user_email,
                "metadata": user_metadata,
            },
            "profile": profile,
            "session": {
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
                "expires_in": session.expires_in,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        if _is_invalid_credentials_error(exc):
            raise HTTPException(status_code=401, detail="Invalid credentials") from exc
        if _is_supabase_network_error(exc):
            if DEMO_AUTH_FALLBACK_ENABLED:
                return _build_demo_auth_response(payload.email)
            raise HTTPException(
                status_code=503,
                detail="Authentication service is unreachable. Check SUPABASE_URL and network connectivity.",
            ) from exc
        raise HTTPException(status_code=401, detail=f"Sign in failed: {exc}") from exc


@app.get("/api/auth/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    profile = _upsert_profile_from_auth_user(
        user_id=current_user.get("id"),
        email=current_user.get("email"),
        metadata=current_user.get("metadata", {}),
    )
    merged_metadata = dict(current_user.get("metadata", {}) or {})
    if profile and profile.get("username"):
        merged_metadata["username"] = profile.get("username")
    if profile and profile.get("avatar_url"):
        merged_metadata["avatar_url"] = profile.get("avatar_url")
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "metadata": merged_metadata,
        "profile": profile,
    }


@app.get("/api/profile")
async def get_profile(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    user_id = current_user["id"]
    admin_client = _require_supabase_admin()

    try:
        response = (
            admin_client.table("profiles")
            .select("id, username, avatar_url, created_at, updated_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if rows:
            return rows[0]
    except Exception:
        pass

    metadata = current_user.get("metadata", {}) or {}
    profile = _upsert_profile_from_auth_user(
        user_id=user_id,
        email=current_user.get("email"),
        metadata=metadata,
    )
    if profile:
        return profile

    return {
        "id": user_id,
        "username": _derive_username(current_user.get("email"), metadata),
        "avatar_url": metadata.get("avatar_url"),
        "created_at": None,
        "updated_at": None,
    }


@app.put("/api/profile")
async def upsert_profile(
    payload: ProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = current_user["id"]
    admin_client = _require_supabase_admin()

    row = {
        "id": user_id,
        "username": payload.username,
        "avatar_url": payload.avatar_url,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    try:
        response = admin_client.table("profiles").upsert(row).execute()
        if response.data:
            return response.data[0]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {exc}") from exc

    return row


@app.post("/api/storage/upload")
async def upload_storage_object(
    bucket: str = Form(...),
    file: UploadFile = File(...),
    path: Optional[str] = Form(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    admin_client = _require_supabase_admin()
    object_path = path or f"{current_user['id']}/{uuid.uuid4().hex}-{file.filename}"

    try:
        payload = await file.read()
        admin_client.storage.from_(bucket).upload(
            path=object_path,
            file=payload,
            file_options={
                "cache-control": "3600",
                "upsert": "true",
                "content-type": file.content_type or "application/octet-stream",
            },
        )
        public_url = admin_client.storage.from_(bucket).get_public_url(object_path)
        return {
            "bucket": bucket,
            "path": object_path,
            "public_url": public_url,
            "content_type": file.content_type,
            "size": len(payload),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {exc}") from exc


@app.get("/api/storage/list")
async def list_storage_objects(
    bucket: str,
    path: str = "",
    limit: int = 100,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    admin_client = _require_supabase_admin()

    try:
        objects = admin_client.storage.from_(bucket).list(
            path=path,
            options={"limit": limit, "offset": offset},
        )
        return {"bucket": bucket, "path": path, "objects": objects, "requested_by": current_user["id"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Storage list failed: {exc}") from exc


@app.delete("/api/storage/object")
async def delete_storage_object(
    payload: StorageDeleteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    admin_client = _require_supabase_admin()

    try:
        admin_client.storage.from_(payload.bucket).remove([payload.path])
        return {
            "deleted": True,
            "bucket": payload.bucket,
            "path": payload.path,
            "requested_by": current_user["id"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Storage delete failed: {exc}") from exc


@app.get("/api/agents")
async def list_agents() -> List[Dict[str, Any]]:
    return [_model_dump(agent) for agent in AGENT_REGISTRY.values()]


@app.get("/api/agents/{agent_type}")
async def get_agent(agent_type: str) -> Dict[str, Any]:
    if agent_type not in AGENT_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_type}' not found")
    return _model_dump(AGENT_REGISTRY[agent_type])


@app.post("/api/match/start")
async def start_match(request: MatchRequest) -> Dict[str, Any]:
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
    }

    return state_to_dict(game_state, match_id)


@app.post("/api/match/{match_id}/step")
async def step_match(match_id: str) -> Dict[str, Any]:
    if match_id not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")

    match = active_matches[match_id]
    match["rally"] += 1
    state = match["state"]

    if state.player_pos:
        state.player_pos["x"] = max(0.05, min(0.45, state.player_pos["x"] + random.uniform(-0.05, 0.05)))
        state.player_pos["y"] = max(0.1, min(0.9, state.player_pos["y"] + random.uniform(-0.05, 0.05)))

    if state.opponent_pos:
        state.opponent_pos["x"] = max(0.55, min(0.95, state.opponent_pos["x"] + random.uniform(-0.05, 0.05)))
        state.opponent_pos["y"] = max(0.1, min(0.9, state.opponent_pos["y"] + random.uniform(-0.05, 0.05)))

    state.shuttle_zone = random.randint(1, 8)

    if state.stamina is not None:
        state.stamina = max(0, state.stamina - random.uniform(1, 5))

    actions = ["SMASH", "CLEAR", "DROP_SHOT", "DRIVE", "LOB", "NET_SHOT"]
    last_action = random.choice(actions)

    if match["rally"] % 10 == 0:
        if random.random() > 0.5:
            state.score["p1"] += 1
        else:
            state.score["p2"] += 1

    is_terminal = state.score.get("p1", 0) >= 21 or state.score.get("p2", 0) >= 21

    result = state_to_dict(state, match_id, match["rally"])
    result["last_action"] = last_action
    result["decision_time_ms"] = round(random.uniform(2, 150), 1)
    result["is_terminal"] = is_terminal

    if is_terminal:
        winner = match["agent1"] if state.score["p1"] > state.score["p2"] else match["agent2"]
        history_row = {
            "id": match_id,
            "agent1": match["agent1"],
            "agent2": match["agent2"],
            "score": state.score,
            "winner": winner,
            "rally_count": match["rally"],
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        match_history.insert(0, history_row)
        _persist_match_history(history_row)
        del active_matches[match_id]

    return result


@app.get("/api/match/{match_id}/state")
async def get_match_state(match_id: str) -> Dict[str, Any]:
    if match_id not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")
    match = active_matches[match_id]
    return state_to_dict(match["state"], match_id, match["rally"])


@app.post("/api/match/run")
async def run_full_match(request: MatchRequest) -> Dict[str, Any]:
    if request.agent1 not in AGENT_REGISTRY or request.agent2 not in AGENT_REGISTRY:
        raise HTTPException(status_code=400, detail="Unknown agent in request")

    score = {"p1": 0, "p2": 0}
    rally_count = 0

    while score["p1"] < 21 and score["p2"] < 21:
        rally_count += 1
        if random.random() > 0.5:
            score["p1"] += 1
        else:
            score["p2"] += 1

    winner = request.agent1 if score["p1"] > score["p2"] else request.agent2
    record = {
        "id": str(uuid.uuid4())[:8],
        "agent1": request.agent1,
        "agent2": request.agent2,
        "score": score,
        "winner": winner,
        "rally_count": rally_count,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    match_history.insert(0, record)
    _persist_match_history(record)
    return record


@app.get("/api/leaderboard")
async def get_leaderboard() -> List[Dict[str, Any]]:
    db_rows = _fetch_leaderboard_from_db()
    if db_rows is not None and len(db_rows) > 0:
        return db_rows
    return leaderboard_data


@app.get("/api/history")
async def get_history(limit: int = 20) -> List[Dict[str, Any]]:
    safe_limit = max(1, min(limit, 100))
    db_rows = _fetch_history_from_db(safe_limit)
    if db_rows is not None:
        return db_rows
    return match_history[:safe_limit]


@app.get("/api/config")
async def get_config() -> Dict[str, Any]:
    return {"game": GAME_CONFIG, "agents": AGENT_CONFIG}


if __name__ == "__main__":
    import uvicorn

    print("=" * 55)
    print("  SmartSmash API Server starting on http://localhost:8000")
    print("  API docs at http://localhost:8000/docs")
    print("=" * 55)

    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(BACKEND_DIR)],
    )
