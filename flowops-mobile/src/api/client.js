// FlowOps API Client
// JWT-aware fetch utility using Expo Secure Store
// All business logic stays in the backend — this only sends requests

import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/config';
import { logError } from '../utils/logger';

const TOKEN_KEY = 'flowops_token';
const USER_KEY = 'flowops_user';

// ─── Token Helpers ────────────────────────────────────────────────────────────
export const saveToken = async (token) => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async () => {
  return await SecureStore.getItemAsync(TOKEN_KEY);
};

export const saveUser = async (user) => {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
};

export const getUser = async () => {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const clearSession = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
};

// ─── Core Fetch Utility ───────────────────────────────────────────────────────
export const apiRequest = async (endpoint, options = {}) => {
  const token = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    method: options.method || 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    try {
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        const error = new Error(`JSON parse error. Status: ${response.status}`);
        error.url = `${API_URL}${endpoint}`;
        error.method = options.method || 'GET';
        error.status = response.status;
        error.responseBody = text;
        throw error;
      }

      if (!response.ok) {
        const error = new Error(data?.message || `Request failed: ${response.status}`);
        error.url = `${API_URL}${endpoint}`;
        error.method = options.method || 'GET';
        error.status = response.status;
        error.responseBody = data;
        throw error;
      }

      return data;
    } catch (parseErr) {
      if (parseErr.url) throw parseErr;
      const error = new Error(`Network/Parse error: ${parseErr.message}`);
      throw error;
    }
  } catch (error) {
    if (!error.url) {
      error.url = `${API_URL}${endpoint}`;
      error.method = options.method || 'GET';
    }
    logError(error, `API Request: ${options.method || 'GET'} ${endpoint}`);
    throw error;
  }
};

// ─── Multipart Upload (for POD images) ────────────────────────────────────────
export const apiUpload = async (endpoint, formData) => {
  const token = await getToken();

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    try {
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        const error = new Error(`JSON parse error. Status: ${response.status}`);
        error.url = `${API_URL}${endpoint}`;
        error.method = 'POST';
        error.status = response.status;
        error.responseBody = text;
        throw error;
      }

      if (!response.ok) {
        const error = new Error(data?.message || 'Upload failed');
        error.url = `${API_URL}${endpoint}`;
        error.method = 'POST';
        error.status = response.status;
        error.responseBody = data;
        throw error;
      }

      return data;
    } catch (parseErr) {
      if (parseErr.url) throw parseErr;
      const error = new Error(`Network/Parse error: ${parseErr.message}`);
      throw error;
    }
  } catch (error) {
    if (!error.url) {
      error.url = `${API_URL}${endpoint}`;
      error.method = 'POST';
    }
    logError(error, `API Upload: POST ${endpoint}`);
    throw error;
  }
};

