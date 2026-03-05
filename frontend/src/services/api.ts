import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  timeout: 30000, // 30s timeout for ML tasks
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error Response:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
