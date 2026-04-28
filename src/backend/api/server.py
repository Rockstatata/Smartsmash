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
from agents import AGENT_TYPES, make_agent

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


class MatchCompleteRequest(BaseModel):
    winner: str
    winnerName: Optional[str] = None
    score: Dict[str, int]
    rallyCount: int = 0
    durationSec: int = 0
    setupSnapshot: Optional[Dict[str, Any]] = None


class DecideRequest(BaseModel):
    """Frontend snapshot used by the live canvas to ask one agent for one action.

    All fields are optional; the bridge fills in safe defaults. Coordinates
    and zones use the same conventions the canvas already produces.
    """

    player: str = Field(default="p1", description="Which side to decide for: 'p1' or 'p2'.")
    player_pos: Optional[Dict[str, float]] = None
    opponent_pos: Optional[Dict[str, float]] = None
    shuttle_zone: Optional[int] = None
    shuttle_height: Optional[float] = None
    stamina: Optional[float] = None
    opponent_stamina: Optional[float] = None
    power: Optional[float] = None
    opponent_power: Optional[float] = None
    score: Optional[Dict[str, int]] = None


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


def _persist_leaderboard_row(row: Dict[str, Any]) -> None:
    if not supabase_admin:
        return
    try:
        supabase_admin.table("leaderboard").upsert(
            {
                "name": row.get("name", "Unknown"),
                "elo": float(row.get("elo", 1500)),
                "winrate": float(row.get("winrate", 0)),
                "points": int(row.get("points", 0)),
                "matches": int(row.get("matches", 0)),
                "color": row.get("color", "#4A9EFF"),
                "description": row.get("description", ""),
            },
            on_conflict="name",
        ).execute()
    except Exception:
        pass


def _find_or_create_leaderboard_row(agent_name: str) -> Dict[str, Any]:
    for row in leaderboard_data:
        if str(row.get("name", "")).strip().lower() == agent_name.strip().lower():
            return row

    new_row = {
        "rank": len(leaderboard_data) + 1,
        "name": agent_name,
        "elo": 1500.0,
        "winrate": 0.0,
        "points": 0,
        "matches": 0,
        "color": "#4A9EFF",
        "description": "Live arena competitor",
    }
    leaderboard_data.append(new_row)
    return new_row


def _recompute_ranks() -> None:
    leaderboard_data.sort(key=lambda row: float(row.get("elo", 0)), reverse=True)
    for idx, row in enumerate(leaderboard_data, start=1):
        row["rank"] = idx


def _apply_match_result_to_leaderboard(agent1_name: str, agent2_name: str, winner_name: str) -> None:
    a = _find_or_create_leaderboard_row(agent1_name)
    b = _find_or_create_leaderboard_row(agent2_name)

    ra = float(a.get("elo", 1500))
    rb = float(b.get("elo", 1500))
    ea = 1.0 / (1.0 + 10 ** ((rb - ra) / 400.0))
    eb = 1.0 - ea

    a_win = winner_name.strip().lower() == agent1_name.strip().lower()
    sa = 1.0 if a_win else 0.0
    sb = 0.0 if a_win else 1.0
    k = 24.0

    a["elo"] = round(ra + k * (sa - ea), 2)
    b["elo"] = round(rb + k * (sb - eb), 2)

    a["matches"] = int(a.get("matches", 0)) + 1
    b["matches"] = int(b.get("matches", 0)) + 1

    a_wins = round(float(a.get("winrate", 0)) * max(0, a["matches"] - 1) / 100.0)
    b_wins = round(float(b.get("winrate", 0)) * max(0, b["matches"] - 1) / 100.0)
    if a_win:
        a_wins += 1
    else:
        b_wins += 1

    a["winrate"] = round((a_wins / max(1, a["matches"])) * 100.0, 1)
    b["winrate"] = round((b_wins / max(1, b["matches"])) * 100.0, 1)
    a["points"] = int(a_wins * 50)
    b["points"] = int(b_wins * 50)

    _persist_leaderboard_row(a)
    _persist_leaderboard_row(b)
    _recompute_ranks()


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


def _resolve_agent_type(name: str) -> str:
    """Map registry keys / human names onto factory keys."""
    key = (name or "").strip().lower()
    if key in AGENT_TYPES:
        return key
    if key in AGENT_REGISTRY:
        return AGENT_REGISTRY[key].type
    raise HTTPException(status_code=400, detail=f"Unknown agent: {name!r}")


def _build_decide_state(payload: DecideRequest, match: Optional[Dict[str, Any]] = None) -> GameState:
    state = GameState()
    state.player_pos = dict(payload.player_pos or {"x": 0.25, "y": 0.5})
    state.opponent_pos = dict(payload.opponent_pos or {"x": 0.75, "y": 0.5})
    state.shuttle_zone = int(payload.shuttle_zone) if payload.shuttle_zone is not None else 4
    state.shuttle_height = float(payload.shuttle_height) if payload.shuttle_height is not None else 1.5
    state.stamina = float(payload.stamina) if payload.stamina is not None else 100.0
    state.power = float(payload.power) if payload.power is not None else 0.0
    setattr(state, "opponent_stamina", float(payload.opponent_stamina) if payload.opponent_stamina is not None else 100.0)
    setattr(state, "opponent_power", float(payload.opponent_power) if payload.opponent_power is not None else 0.0)
    if payload.score:
        state.score = {"p1": int(payload.score.get("p1", 0)), "p2": int(payload.score.get("p2", 0))}
    elif match is not None:
        state.score = dict(match["state"].score or {"p1": 0, "p2": 0})
    else:
        state.score = {"p1": 0, "p2": 0}
    setattr(state, "current_turn", payload.player or "p1")
    return state


@app.post("/api/match/start")
async def start_match(request: MatchRequest) -> Dict[str, Any]:
    agent1_type = _resolve_agent_type(request.agent1)
    agent2_type = _resolve_agent_type(request.agent2)

    match_id = str(uuid.uuid4())[:8]
    game_state = create_initial_state()

    try:
        agent1 = make_agent(agent1_type, player_key="p1")
        agent2 = make_agent(agent2_type, player_key="p2")
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Failed to instantiate agents: {exc}") from exc

    active_matches[match_id] = {
        "id": match_id,
        "agent1": agent1_type,
        "agent2": agent2_type,
        "agents": {"p1": agent1, "p2": agent2},
        "state": game_state,
        "rally": 0,
        "started_at": time.time(),
        "current_turn": "p1",
        "p1_stamina": 100.0,
        "p2_stamina": 100.0,
        "p1_power": 0.0,
        "p2_power": 0.0,
    }

    return state_to_dict(game_state, match_id)


@app.post("/api/match/{match_id}/decide")
async def decide_action(match_id: str, payload: DecideRequest) -> Dict[str, Any]:
    """Ask the agent on side ``payload.player`` to pick one action.

    The frontend canvas calls this on every shuttle hand-off to get a
    real Minimax / MCTS / Fuzzy decision instead of a local heuristic.
    """
    if match_id not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")

    match = active_matches[match_id]
    side = (payload.player or "p1").strip().lower()
    if side not in {"p1", "p2"}:
        raise HTTPException(status_code=400, detail="player must be 'p1' or 'p2'")

    agent = match.get("agents", {}).get(side)
    if agent is None:
        raise HTTPException(status_code=500, detail=f"No agent registered for {side}")

    state = _build_decide_state(payload, match)

    t0 = time.perf_counter()
    try:
        result = agent.decide(state)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Agent decision failed: {exc}") from exc

    if isinstance(result, tuple) and len(result) == 2:
        action, explanation = result
    else:
        action, explanation = str(result), {}

    decision_time_ms = round((time.perf_counter() - t0) * 1000.0, 3)
    if isinstance(explanation, dict) and "decision_time_ms" not in explanation:
        explanation = {**explanation, "decision_time_ms": decision_time_ms}

    return {
        "match_id": match_id,
        "player": side,
        "agent": match["agents"][side].name if hasattr(match["agents"][side], "name") else side,
        "agent_type": match["agent1"] if side == "p1" else match["agent2"],
        "action": str(action),
        "decision_time_ms": decision_time_ms,
        "explanation": explanation,
    }


def _build_rally_state(match: Dict[str, Any], current_turn: str) -> GameState:
    """Project the live match dict into a GameState for the active agent."""
    base = match["state"]
    state = GameState()

    if current_turn == "p1":
        state.player_pos = dict(base.player_pos or {"x": 0.25, "y": 0.5})
        state.opponent_pos = dict(base.opponent_pos or {"x": 0.75, "y": 0.5})
    else:
        state.player_pos = dict(base.opponent_pos or {"x": 0.75, "y": 0.5})
        state.opponent_pos = dict(base.player_pos or {"x": 0.25, "y": 0.5})

    state.shuttle_zone = base.shuttle_zone or 4
    state.shuttle_height = base.shuttle_height if base.shuttle_height is not None else 1.5

    p1_stamina = match.get("p1_stamina", 100.0)
    p2_stamina = match.get("p2_stamina", 100.0)
    p1_power = match.get("p1_power", 0.0)
    p2_power = match.get("p2_power", 0.0)

    if current_turn == "p1":
        state.stamina = p1_stamina
        state.power = p1_power
        setattr(state, "opponent_stamina", p2_stamina)
        setattr(state, "opponent_power", p2_power)
    else:
        state.stamina = p2_stamina
        state.power = p2_power
        setattr(state, "opponent_stamina", p1_stamina)
        setattr(state, "opponent_power", p1_power)

    state.score = dict(base.score or {"p1": 0, "p2": 0})
    setattr(state, "current_turn", current_turn)
    return state


def _apply_rally_outcome(match: Dict[str, Any], actor: str, action: str) -> str:
    """Apply a single rally exchange to the live match dict and return point winner."""
    defender = "p2" if actor == "p1" else "p1"
    state = match["state"]

    cost = {
        "SMASH": 12.0, "SPECIAL": 10.0, "CLEAR": 6.0, "LOB": 6.0,
        "DRIVE": 7.0, "DROP_SHOT": 5.0, "NET_SHOT": 4.0,
        "MOVE_LEFT": 2.0, "MOVE_RIGHT": 2.0, "STAY": 1.0,
    }.get(action, 5.0)
    gain = {
        "SMASH": 8.0, "SPECIAL": -100.0, "CLEAR": 5.0, "LOB": 4.0,
        "DRIVE": 4.0, "DROP_SHOT": 3.0, "NET_SHOT": 3.0,
    }.get(action, 2.0)

    match[f"{actor}_stamina"] = max(0.0, match.get(f"{actor}_stamina", 100.0) - cost)
    match[f"{defender}_stamina"] = min(100.0, match.get(f"{defender}_stamina", 100.0) + 1.5)
    match[f"{actor}_power"] = max(0.0, min(100.0, match.get(f"{actor}_power", 0.0) + gain))

    p_actor = 0.5
    if action == "SMASH":
        p_actor = 0.58 + 0.0015 * match.get(f"{actor}_stamina", 100.0)
    elif action == "SPECIAL":
        p_actor = 0.65
    elif action in ("DROP_SHOT", "NET_SHOT"):
        p_actor = 0.52
    elif action in ("CLEAR", "LOB"):
        p_actor = 0.48
    elif action == "DRIVE":
        p_actor = 0.50
    p_actor = max(0.05, min(0.95, p_actor))

    winner = actor if random.random() < p_actor else defender
    state.score[winner] = state.score.get(winner, 0) + 1

    state.shuttle_zone = random.randint(1, 8)
    state.shuttle_height = random.uniform(0.8, 3.0)
    return winner


@app.post("/api/match/{match_id}/step")
async def step_match(match_id: str) -> Dict[str, Any]:
    """Run one rally exchange via the registered agents and return the new state."""
    if match_id not in active_matches:
        raise HTTPException(status_code=404, detail="Match not found")

    match = active_matches[match_id]
    match["rally"] += 1
    current_turn = match.get("current_turn", "p1")
    state = match["state"]

    agent = match["agents"][current_turn]
    snapshot = _build_rally_state(match, current_turn)

    t0 = time.perf_counter()
    try:
        result = agent.decide(snapshot)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Agent step failed: {exc}") from exc

    if isinstance(result, tuple) and len(result) == 2:
        action, explanation = result
    else:
        action, explanation = str(result), {}
    decision_time_ms = round((time.perf_counter() - t0) * 1000.0, 3)

    point_winner = _apply_rally_outcome(match, current_turn, str(action))
    match["current_turn"] = point_winner

    is_terminal = state.score.get("p1", 0) >= 5 or state.score.get("p2", 0) >= 5

    result_payload = state_to_dict(state, match_id, match["rally"])
    result_payload["last_action"] = str(action)
    result_payload["decision_time_ms"] = decision_time_ms
    result_payload["is_terminal"] = is_terminal
    result_payload["current_turn"] = match["current_turn"]
    result_payload["actor"] = current_turn
    result_payload["point_winner"] = point_winner
    result_payload["explanation"] = explanation if isinstance(explanation, dict) else {}

    if is_terminal:
        winner_side = "p1" if state.score["p1"] > state.score["p2"] else "p2"
        winner_agent = match["agent1"] if winner_side == "p1" else match["agent2"]
        history_row = {
            "id": match_id,
            "agent1": match["agent1"],
            "agent2": match["agent2"],
            "score": state.score,
            "winner": winner_agent,
            "rally_count": match["rally"],
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        match_history.insert(0, history_row)
        _persist_match_history(history_row)
        del active_matches[match_id]

    return result_payload


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

    while score["p1"] < 5 and score["p2"] < 5:
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
    _apply_match_result_to_leaderboard(request.agent1, request.agent2, winner)
    return record


@app.post("/api/match/complete")
async def complete_match(payload: MatchCompleteRequest) -> Dict[str, Any]:
    setup = payload.setupSnapshot or {}
    p1_name = (
        setup.get("players", {})
        .get("p1", {})
        .get("name")
        or setup.get("players", {}).get("p1", {}).get("agentType")
        or "Player One"
    )
    p2_name = (
        setup.get("players", {})
        .get("p2", {})
        .get("name")
        or setup.get("players", {}).get("p2", {}).get("agentType")
        or "Player Two"
    )

    winner_name = payload.winnerName or (p1_name if payload.winner == "p1" else p2_name)
    record = {
        "id": str(uuid.uuid4())[:8],
        "agent1": p1_name,
        "agent2": p2_name,
        "score": payload.score,
        "winner": winner_name,
        "rally_count": payload.rallyCount,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    match_history.insert(0, record)
    _persist_match_history(record)
    _apply_match_result_to_leaderboard(p1_name, p2_name, winner_name)
    return {
        "ok": True,
        "record": record,
        "leaderboard": leaderboard_data,
    }


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
    # If DB is reachable but currently empty, fall back to in-memory history
    # so the frontend still shows freshly simulated matches.
    if db_rows is not None and len(db_rows) > 0:
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
