/* ═══════════════════════════════════════════════════════════
   SmartSmash — API Client Service
   Handles communication with the FastAPI backend bridge
   ═══════════════════════════════════════════════════════════ */

// Global toggle to disable network requests during frontend-only development or when the
// backend is unavailable. Setting to false effectively comments out all fetch calls and
// causes exported helper functions to gracefully return `null` or simple defaults.
export const USE_API = false;

const BASE_URL = 'http://localhost:8000/api';

/**
 * Generic fetch wrapper with error handling.
 * @param {string} endpoint - API endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise<object|null>} Parsed JSON response
 */
async function request(endpoint, options = {}) {
  // if the toggle is off, skip any network activity and return null so callers can
  // fallback to defaults. This is equivalent to commenting out each individual call.
  if (!USE_API) {
    console.warn('[SmartSmash API] disabled - skipping request to', endpoint);
    return null;
  }

  const url = BASE_URL + endpoint;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('[SmartSmash API]', error.message);
    return null;
  }
}


/* ─── Match Endpoints ────────────────────────────────────── */

/**
 * Starts a new match between two agents.
 * @param {string} agent1 - First agent type (minimax, mcts, fuzzy)
 * @param {string} agent2 - Second agent type
 * @returns {Promise<object>} Match initialization data
 */
export function startMatch(agent1, agent2) {
  return request('/match/start', {
    method: 'POST',
    body: JSON.stringify({ agent1, agent2 }),
  });
}

/**
 * Advances the match by one step (one rally turn).
 * @param {string} matchId - Active match identifier
 * @returns {Promise<object>} Updated game state
 */
export function stepMatch(matchId) {
  return request(`/match/${matchId}/step`, { method: 'POST' });
}

/**
 * Retrieves the current state of an active match.
 * @param {string} matchId - Active match identifier
 * @returns {Promise<object>} Current game state
 */
export function getMatchState(matchId) {
  return request(`/match/${matchId}/state`);
}

/**
 * Runs a full match to completion and returns the result.
 * @param {string} agent1 - First agent type
 * @param {string} agent2 - Second agent type
 * @returns {Promise<object>} Complete match result
 */
export function runFullMatch(agent1, agent2) {
  return request('/match/run', {
    method: 'POST',
    body: JSON.stringify({ agent1, agent2 }),
  });
}


/* ─── Agent Endpoints ────────────────────────────────────── */

/**
 * Lists all available AI agents and their configurations.
 * @returns {Promise<Array>} List of agent metadata
 */
export function getAgents() {
  return request('/agents');
}

/**
 * Gets detailed information about a specific agent.
 * @param {string} agentType - Agent type identifier
 * @returns {Promise<object>} Agent detail
 */
export function getAgentDetail(agentType) {
  return request(`/agents/${agentType}`);
}


/* ─── Leaderboard Endpoints ──────────────────────────────── */

/**
 * Retrieves the current agent leaderboard standings.
 * @returns {Promise<Array>} Leaderboard data
 */
export function getLeaderboard() {
  return request('/leaderboard');
}


/* ─── Match History Endpoints ────────────────────────────── */

/**
 * Retrieves match history (most recent first).
 * @param {number} limit - Maximum entries to return
 * @returns {Promise<Array>} Match history records
 */
export function getMatchHistory(limit) {
  const query = limit ? `?limit=${limit}` : '';
  return request(`/history${query}`);
}


/* ─── Health Check ───────────────────────────────────────── */

/**
 * Checks if the backend server is operational.
 * @returns {Promise<boolean>} True if server is responsive
 */
export async function healthCheck() {
  try {
    const data = await request('/health');
    return data !== null && data.status === 'ok';
  } catch {
    return false;
  }
}
