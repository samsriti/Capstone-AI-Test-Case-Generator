import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const signup = (userData) => api.post('/signup', userData);

export const login = async (email, password) => {
  const formData = new FormData();
  formData.append('username', email); // API expects 'username' field
  formData.append('password', password);
  return api.post('/token', formData);
};

export const getCurrentUser = () => api.get('/users/me');

// Project APIs
export const getProjects = () => api.get('/projects');

export const createProject = (projectData) => api.post('/projects', projectData);

export const getProject = (projectId) => api.get(`/projects/${projectId}`);

export const updateProject = (projectId, projectData) => 
  api.put(`/projects/${projectId}`, projectData);

export const deleteProject = (projectId) => api.delete(`/projects/${projectId}`);

// Test Case APIs
export const generateTestCases = (projectId, data) => 
  api.post(`/projects/${projectId}/generate-test-cases`, data);

export const getTestCasesByFeature = (projectId, featureName) => 
  api.get(`/projects/${projectId}/features/${featureName}/test-cases`);

export const deleteFeature = (projectId, featureName) => 
  api.delete(`/projects/${projectId}/features/${featureName}`);

// Helper functions
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