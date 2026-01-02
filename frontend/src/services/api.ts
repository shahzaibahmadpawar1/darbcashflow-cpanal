import axios from 'axios';

// Use environment variable or default to localhost for development
// For cPanel deployment, set VITE_API_URL to your backend URL
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production'
    ? '' // Set this to your cPanel backend URL
    : 'http://localhost:5000');
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

