import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL, DEBUG_MODE } from '../config/config';

const LOGS_KEY = 'flowops_error_logs';
let isInitialized = false;

// Get device information without external libraries
const getDeviceInfo = () => {
  const info = {
    platform: Platform.OS,
    version: Platform.Version,
    appVersion: '1.0.0', // Standard app version
  };
  if (Platform.OS === 'android') {
    info.brand = Platform.constants?.Brand || 'Unknown Brand';
    info.model = Platform.constants?.Model || 'Unknown Model';
    info.androidVersion = Platform.constants?.Release || 'Unknown';
  } else if (Platform.OS === 'ios') {
    info.model = Platform.constants?.model || 'iPhone/iPad';
  }
  return info;
};

// Format error details
export const formatError = (error, context = 'Unknown', userId = null, userRole = null) => {
  const message = error?.message || error?.toString() || 'Unknown Error';
  const stack = error?.stack || 'No stack trace available';
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: message,
    stack: stack.substring(0, 1000), // Limit stack size
    screen: context,
    userId: userId,
    userRole: userRole,
    deviceInfo: getDeviceInfo()
  };

  // Capture network/API details if attached to the error object
  if (error?.url) {
    logEntry.apiDetails = {
      url: error.url,
      method: error.method || 'GET',
      status: error.status || 'N/A',
      response: typeof error.responseBody === 'object' 
        ? JSON.stringify(error.responseBody) 
        : error.responseBody || 'N/A'
    };
  }

  return logEntry;
};

// Get stored logs
export const getLocalLogs = async () => {
  try {
    const raw = await SecureStore.getItemAsync(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read logs from SecureStore:', e);
    return [];
  }
};

// Save logs locally
export const saveLocalLogs = async (logs) => {
  try {
    const trimmed = logs.slice(0, 15); // Keep last 15 logs
    await SecureStore.setItemAsync(LOGS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save logs to SecureStore:', e);
  }
};

// Clear all local logs
export const clearLocalLogs = async () => {
  try {
    await SecureStore.deleteItemAsync(LOGS_KEY);
  } catch (e) {
    console.error('Failed to delete logs from SecureStore:', e);
  }
};

// Report error to backend
export const reportErrorToBackend = async (logEntry) => {
  try {
    const token = await SecureStore.getItemAsync('flowops_token');
    
    const body = {
      error: logEntry.error,
      stack: logEntry.stack,
      deviceInfo: logEntry.deviceInfo,
      screen: logEntry.screen,
      userId: logEntry.userId,
      userRole: logEntry.userRole,
      apiDetails: logEntry.apiDetails || null
    };

    const response = await fetch(`${API_URL}/logs/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn('Backend logging responded with error status:', response.status);
    }
  } catch (e) {
    console.warn('Failed to send error log to backend:', e.message);
  }
};

// Main function to log a new error
export const logError = async (error, context = 'General') => {
  let userId = null;
  let userRole = null;
  
  try {
    const userRaw = await SecureStore.getItemAsync('flowops_user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      userId = user.id || null;
      userRole = user.role || null;
    }
  } catch (e) {
    console.warn('Could not read user details for error logging:', e.message);
  }

  const logEntry = formatError(error, context, userId, userRole);
  console.error(`[LOGGER - ${context}]:`, logEntry.error);

  // 1. Save locally
  const currentLogs = await getLocalLogs();
  currentLogs.unshift(logEntry);
  await saveLocalLogs(currentLogs);

  // 2. Report to backend asynchronously
  reportErrorToBackend(logEntry);
};

// Initialize global exception handlers
export const initGlobalErrorHandler = () => {
  if (isInitialized) return;
  isInitialized = true;

  if (global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      logError(error, isFatal ? 'Fatal Crash' : 'Unhandled JS Error');
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  const originalUnhandledRejection = global.onunhandledrejection;
  global.onunhandledrejection = (event) => {
    const error = event?.reason || new Error('Unhandled Promise Rejection');
    logError(error, 'Unhandled Rejection');
    if (originalUnhandledRejection) {
      originalUnhandledRejection(event);
    }
  };

  console.log('✅ FlowOps In-App Error Tracking Initialized');
};
