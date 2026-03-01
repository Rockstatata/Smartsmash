/* ═══════════════════════════════════════════════════════════
   SmartSmash — API Client Module
   Handles communication with the FastAPI backend bridge
   ═══════════════════════════════════════════════════════════ */

/**
 * SmartSmash API Client.
 * Communicates with the FastAPI backend that bridges to the
 * Python AI simulation engine.
 */
var SmartSmashAPI = (function () {
  'use strict';

  // Base URL for the FastAPI server
  var BASE_URL = 'http://localhost:8000/api';

  /**
   * Generic fetch wrapper with error handling.
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Parsed JSON response
   */
  function request(endpoint, options) {
    var url = BASE_URL + endpoint;
    var defaults = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    var config = Object.assign({}, defaults, options || {});

    return fetch(url, config)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('API Error: ' + response.status + ' ' + response.statusText);
        }
        return response.json();
      })
      .catch(function (error) {
        console.warn('[SmartSmash API]', error.message);
        return null;
      });
  }


  /* ─── Match Endpoints ────────────────────────────────── */

  /**
   * Starts a new match between two agents.
   * @param {string} agent1 - First agent type (minimax, mcts, fuzzy)
   * @param {string} agent2 - Second agent type
   * @returns {Promise<object>} Match initialization data
   */
  function startMatch(agent1, agent2) {
    return request('/match/start', {
      method: 'POST',
      body: JSON.stringify({
        agent1: agent1,
        agent2: agent2
      })
    });
  }

  /**
   * Advances the match by one step (one rally turn).
   * @param {string} matchId - Active match identifier
   * @returns {Promise<object>} Updated game state
   */
  function stepMatch(matchId) {
    return request('/match/' + matchId + '/step', {
      method: 'POST'
    });
  }

  /**
   * Retrieves the current state of an active match.
   * @param {string} matchId - Active match identifier
   * @returns {Promise<object>} Current game state
   */
  function getMatchState(matchId) {
    return request('/match/' + matchId + '/state');
  }

  /**
   * Runs a full match to completion and returns the result.
   * @param {string} agent1 - First agent type
   * @param {string} agent2 - Second agent type
   * @returns {Promise<object>} Complete match result
   */
  function runFullMatch(agent1, agent2) {
    return request('/match/run', {
      method: 'POST',
      body: JSON.stringify({
        agent1: agent1,
        agent2: agent2
      })
    });
  }


  /* ─── Agent Endpoints ────────────────────────────────── */

  /**
   * Lists all available AI agents and their configurations.
   * @returns {Promise<Array>} List of agent metadata
   */
  function getAgents() {
    return request('/agents');
  }

  /**
   * Gets detailed information about a specific agent.
   * @param {string} agentType - Agent type identifier
   * @returns {Promise<object>} Agent detail
   */
  function getAgentDetail(agentType) {
    return request('/agents/' + agentType);
  }


  /* ─── Leaderboard Endpoints ──────────────────────────── */

  /**
   * Retrieves the current agent leaderboard standings.
   * @returns {Promise<Array>} Leaderboard data
   */
  function getLeaderboard() {
    return request('/leaderboard');
  }


  /* ─── Match History Endpoints ────────────────────────── */

  /**
   * Retrieves match history (most recent first).
   * @param {number} limit - Maximum entries to return
   * @returns {Promise<Array>} Match history records
   */
  function getMatchHistory(limit) {
    var query = limit ? '?limit=' + limit : '';
    return request('/history' + query);
  }


  /* ─── Health Check ───────────────────────────────────── */

  /**
   * Checks if the backend server is operational.
   * @returns {Promise<boolean>} True if server is responsive
   */
  function healthCheck() {
    return request('/health')
      .then(function (data) {
        return data !== null && data.status === 'ok';
      })
      .catch(function () {
        return false;
      });
  }


  /* ─── Public Interface ───────────────────────────────── */
  return {
    startMatch: startMatch,
    stepMatch: stepMatch,
    getMatchState: getMatchState,
    runFullMatch: runFullMatch,
    getAgents: getAgents,
    getAgentDetail: getAgentDetail,
    getLeaderboard: getLeaderboard,
    getMatchHistory: getMatchHistory,
    healthCheck: healthCheck
  };

})();
