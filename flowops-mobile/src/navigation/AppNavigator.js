// FlowOps App Navigator
// Role-based navigation: Admin, Driver, Customer
// Uses React Navigation — no tabs, just stacks per role

import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import OrdersScreen from '../screens/admin/OrdersScreen';
import CustomersScreen from '../screens/admin/CustomersScreen';
import ProductsScreen from '../screens/admin/ProductsScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import PaymentsScreen from '../screens/admin/PaymentsScreen';
import DebugLogsScreen from '../screens/DebugLogsScreen';

// Driver Screens
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import TrackingScreen from '../screens/driver/TrackingScreen';
import ProofScreen from '../screens/driver/ProofScreen';

// Customer Screens
import CustomerDashboardScreen from '../screens/customer/CustomerDashboardScreen';
import InvoicesScreen from '../screens/customer/InvoicesScreen';
import TrackOrderScreen from '../screens/customer/TrackOrderScreen';

const Stack = createNativeStackNavigator();

const THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#4f46e5',
    background: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
    notification: '#ef4444',
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: '#4f46e5' },
  headerTintColor: '#ffffff',
  headerTitleStyle: { fontWeight: '700', fontSize: 17 },
  headerBackTitleVisible: false,
};

// ─── Auth Stack ───────────────────────────────────────────────────────────────
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

// ─── Admin Stack ──────────────────────────────────────────────────────────────
const AdminStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'FlowOps Admin' }} />
    <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: 'Orders' }} />
    <Stack.Screen name="Customers" component={CustomersScreen} options={{ title: 'Customers' }} />
    <Stack.Screen name="Products" component={ProductsScreen} options={{ title: 'Products' }} />
    <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Users' }} />
    <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Payments' }} />
    <Stack.Screen name="DebugLogs" component={DebugLogsScreen} options={{ title: 'App Debug Logs' }} />
  </Stack.Navigator>
);

// ─── Driver Stack ─────────────────────────────────────────────────────────────
const DriverStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ title: 'My Deliveries' }} />
    <Stack.Screen name="Tracking" component={TrackingScreen} options={{ title: 'Live GPS Tracking' }} />
    <Stack.Screen name="Proof" component={ProofScreen} options={{ title: 'Delivery Proof' }} />
  </Stack.Navigator>
);

// ─── Customer Stack ───────────────────────────────────────────────────────────
const CustomerStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="CustomerDashboard" component={CustomerDashboardScreen} options={{ title: 'My Orders' }} />
    <Stack.Screen name="Invoices" component={InvoicesScreen} options={{ title: 'Invoices' }} />
    <Stack.Screen name="TrackOrder" component={TrackOrderScreen} options={{ title: 'Track Order' }} />
  </Stack.Navigator>
);

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={THEME}>
      {!user ? (
        <AuthStack />
      ) : user.role === 'driver' ? (
        <DriverStack />
      ) : user.role === 'customer' ? (
        <CustomerStack />
      ) : (
        <AdminStack />
      )}
    </NavigationContainer>
  );
}
