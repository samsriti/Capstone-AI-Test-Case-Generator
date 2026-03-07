import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

// How long with no activity before the user is logged out
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Proactively refresh the token when this much time is left on it
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Check whether a refresh is needed this often
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000; // every 1 minute

// ─── Axios instance ──────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_URL,
});

// Attach the Bearer token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Catch 401 responses globally.
// Skip the /token endpoints so that a wrong-password error on the login form
// still surfaces as an error message rather than an unwanted redirect.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    const is401 = error.response?.status === 401;
    const isTokenEndpoint = url.includes('/token');

    if (is401 && !isTokenEndpoint) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth APIs ───────────────────────────────────────────────────────────────

export const signup = (userData) => api.post('/signup', userData);

export const login = async (email, password) => {
  const formData = new FormData();
  formData.append('username', email); // API expects 'username' field
  formData.append('password', password);
  return api.post('/token', formData);
};

export const getCurrentUser = () => api.get('/users/me');

// ─── Project APIs ─────────────────────────────────────────────────────────────

export const getProjects = () => api.get('/projects');

export const createProject = (projectData) => api.post('/projects', projectData);

export const getProject = (projectId) => api.get(`/projects/${projectId}`);

export const updateProject = (projectId, projectData) =>
  api.put(`/projects/${projectId}`, projectData);

export const deleteProject = (projectId) => api.delete(`/projects/${projectId}`);

// ─── Test Case APIs ───────────────────────────────────────────────────────────

export const generateTestCases = (projectId, data) =>
  api.post(`/projects/${projectId}/generate-test-cases`, data);

export const getTestCasesByFeature = (projectId, featureName) =>
  api.get(`/projects/${projectId}/features/${encodeURIComponent(featureName)}/test-cases`);

export const deleteFeature = (projectId, featureName) =>
  api.delete(`/projects/${projectId}/features/${encodeURIComponent(featureName)}`);

export const regenerateTestCases = (projectId, featureName, data) =>
  api.put(`/projects/${projectId}/features/${encodeURIComponent(featureName)}/regenerate`, data);

export const previewCompare = (projectId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/projects/${projectId}/compare/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadAndCompare = (projectId, file, featureMap = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('feature_map', JSON.stringify(featureMap));
  return api.post(`/projects/${projectId}/compare`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ─── Helper functions ─────────────────────────────────────────────────────────

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

export const logout = () => {
  localStorage.removeItem('token');
};

// ─── Session manager ──────────────────────────────────────────────────────────
// Responsibilities:
//   1. Idle timeout  — log out after 30 min with no user activity.
//   2. Token refresh — silently issue a new token before the current one
//      expires, but only while the user is still actively using the app.

let idleTimer = null;
let refreshInterval = null;
let lastActivityTime = Date.now();
let sessionActive = false;

/** Decode the JWT payload and return the expiry as a Unix-ms timestamp. */
function getTokenExpiry() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // JWT exp is in seconds; convert to ms
  } catch {
    return null;
  }
}

/** Ask the backend for a fresh token and store it. */
async function doRefreshToken() {
  try {
    const response = await api.post('/token/refresh');
    setAuthToken(response.data.access_token);
  } catch {
    // The 401 response interceptor above will redirect to /login if
    // the token is already expired and the refresh itself fails.
  }
}

/** Called by the periodic interval — refresh only when it makes sense. */
function checkAndRefreshToken() {
  if (!localStorage.getItem('token')) return;

  const expiry = getTokenExpiry();
  if (!expiry) return;

  const timeUntilExpiry = expiry - Date.now();
  const timeSinceActivity = Date.now() - lastActivityTime;

  // Only refresh if: token is about to expire AND user is still active
  if (
    timeUntilExpiry > 0 &&
    timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS &&
    timeSinceActivity < IDLE_TIMEOUT_MS
  ) {
    doRefreshToken();
  }
}

/** Reset the idle countdown on any user interaction. */
function onUserActivity() {
  lastActivityTime = Date.now();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    logout();
    window.location.href = '/login';
  }, IDLE_TIMEOUT_MS);
}

const ACTIVITY_EVENTS = ['click', 'keypress', 'mousemove', 'scroll', 'touchstart'];

/**
 * Start tracking user activity and managing the session.
 * Safe to call multiple times — cleans up any previous session first.
 */
export function initSessionManager() {
  cleanupSessionManager(); // prevent double-initialisation

  sessionActive = true;
  lastActivityTime = Date.now();

  ACTIVITY_EVENTS.forEach((event) => {
    window.addEventListener(event, onUserActivity, { passive: true });
  });

  // Start the idle countdown immediately
  idleTimer = setTimeout(() => {
    logout();
    window.location.href = '/login';
  }, IDLE_TIMEOUT_MS);

  // Periodically check whether the token needs refreshing
  refreshInterval = setInterval(checkAndRefreshToken, REFRESH_CHECK_INTERVAL_MS);
}

/**
 * Stop all session tracking (call on logout or component unmount).
 */
export function cleanupSessionManager() {
  if (!sessionActive) return;
  sessionActive = false;

  clearTimeout(idleTimer);
  clearInterval(refreshInterval);
  idleTimer = null;
  refreshInterval = null;

  ACTIVITY_EVENTS.forEach((event) => {
    window.removeEventListener(event, onUserActivity);
  });
}
