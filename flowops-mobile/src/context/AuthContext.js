// FlowOps Auth Context
// Manages global auth state: user, role, login/logout
// Uses Expo Secure Store — no AsyncStorage

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { saveToken, saveUser, getUser, getToken, clearSession } from '../api/client';
import { apiRequest } from '../api/client';
import { ENDPOINTS } from '../config/config';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const AuthContext = createContext(null);

const registerForPushNotificationsAsync = async () => {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for push notification!');
    return null;
  }

  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('[Push Token Registered]', token);
  } catch (error) {
    console.warn('Error fetching Expo push token:', error.message);
  }

  return token;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const registerPushToken = async () => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        await apiRequest('/users/push-token', {
          method: 'POST',
          body: { pushToken },
        });
        console.log('Push token successfully registered on backend');
      }
    } catch (err) {
      console.warn('Failed to register push token on backend:', err.message);
    }
  };

  // On app launch, restore session from Secure Store
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await getToken();
        const storedUser = await getUser();
        if (token && storedUser) {
          setUser(storedUser);
          // Register push token in background
          registerPushToken();
        }
      } catch (e) {
        console.warn('Session restore failed:', e.message);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const data = await apiRequest(ENDPOINTS.LOGIN, {
      method: 'POST',
      body: { email, password },
    });

    await saveToken(data.token);
    await saveUser(data.user);
    setUser(data.user);
    
    // Register push token in background
    registerPushToken();
    
    return data.user;
  };

  const logout = async () => {
    await clearSession();
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    isDriver: user?.role === 'driver',
    isCustomer: user?.role === 'customer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
