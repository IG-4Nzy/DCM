import axios from 'axios';
import { getItemFromLocalstorage } from '../helpers/utils';
import { LOCAL_STORAGE_PARAMETERS } from '../helpers/constants';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'; // Configurable via Docker -e VITE_API_BASE_URL

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

request.interceptors.request.use(
  (config) => {
    const token = getItemFromLocalstorage(LOCAL_STORAGE_PARAMETERS.TOKEN);
    if (token) {
      const cleanToken = typeof token === 'string' ? token.replace(/"/g, '') : token;
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      if (window.location.pathname !== '/login') {
        console.warn("Unauthorized request, token may have expired.");
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default request;
