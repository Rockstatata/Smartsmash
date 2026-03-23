/* SmartSmash API + Auth Client */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
export const USE_API = (import.meta.env.VITE_USE_API || 'true').toLowerCase() !== 'false';

const TOKEN_KEY = 'smartsmash_access_token';
const USER_KEY = 'smartsmash_user';

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser() {
  return safeJsonParse(localStorage.getItem(USER_KEY), null);
}

function setStoredUser(user) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function mergeProfileIntoUser(user, profile) {
  if (!user || !profile) return user;
  const metadata = { ...(user.metadata || {}) };
  if (profile.username) metadata.username = profile.username;
  if (profile.avatar_url) metadata.avatar_url = profile.avatar_url;
  return { ...user, metadata };
}

async function hydrateUserWithProfile(user, explicitProfile = null) {
  if (!user) return user;
  if (!USE_API) return user;

  let profile = explicitProfile;
  if (!profile) {
    try {
      profile = await request('/profile');
    } catch {
      profile = null;
    }
  }
  return mergeProfileIntoUser(user, profile);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(endpoint, options = {}) {
  if (!USE_API) {
    console.warn('[SmartSmash API] disabled - skipping request to', endpoint);
    return null;
  }

  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // Ignore JSON parse errors for non-JSON error bodies.
      }
      throw new Error(detail);
    }

    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    console.warn('[SmartSmash API]', error.message);
    throw error;
  }
}

export async function signIn(email, password) {
  const data = await request('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token = data?.session?.access_token;
  if (token) setAuthToken(token);
  if (data?.user) {
    const hydratedUser = await hydrateUserWithProfile(data.user, data?.profile);
    setStoredUser(hydratedUser);
    data.user = hydratedUser;
  }

  return data;
}

export async function signUp(email, password, username) {
  const data = await request('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  });

  const token = data?.session?.access_token;
  if (token) setAuthToken(token);
  if (data?.user) {
    const hydratedUser = await hydrateUserWithProfile(data.user, data?.profile);
    setStoredUser(hydratedUser);
    data.user = hydratedUser;
  }

  return data;
}

export async function signOut() {
  clearAuth();
  return true;
}

export async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await request('/auth/me');
    const user = response?.id ? response : null;
    if (user) {
      const hydratedUser = await hydrateUserWithProfile(user, response?.profile);
      setStoredUser(hydratedUser);
      return hydratedUser;
    }
  } catch {
    clearAuth();
  }

  return null;
}

export async function getProfile() {
  return request('/profile');
}

export async function updateProfile(payload) {
  return request('/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function uploadFile(bucket, file, path = '') {
  if (!USE_API) return null;

  const token = getAuthToken();
  const form = new FormData();
  form.append('bucket', bucket);
  form.append('file', file);
  if (path) form.append('path', path);

  const response = await fetch(`${BASE_URL}/storage/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Ignore JSON parse errors for non-JSON error bodies.
    }
    throw new Error(detail);
  }

  return response.json();
}

export function startMatch(agent1, agent2) {
  return request('/match/start', {
    method: 'POST',
    body: JSON.stringify({ agent1, agent2 }),
  });
}

export function stepMatch(matchId) {
  return request(`/match/${matchId}/step`, { method: 'POST' });
}

export function getMatchState(matchId) {
  return request(`/match/${matchId}/state`);
}

export function runFullMatch(agent1, agent2) {
  return request('/match/run', {
    method: 'POST',
    body: JSON.stringify({ agent1, agent2 }),
  });
}

export function getAgents() {
  return request('/agents');
}

export function getAgentDetail(agentType) {
  return request(`/agents/${agentType}`);
}

export function getLeaderboard() {
  return request('/leaderboard');
}

export function getMatchHistory(limit) {
  const query = limit ? `?limit=${limit}` : '';
  return request(`/history${query}`);
}

export async function healthCheck() {
  try {
    const data = await request('/health');
    return data !== null && data.status === 'ok';
  } catch {
    return false;
  }
}
