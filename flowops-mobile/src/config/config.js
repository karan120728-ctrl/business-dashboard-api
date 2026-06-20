// FlowOps API Configuration
// Single source of truth for all API endpoints

const DEV_API_URL = 'http://192.168.31.173:3000/api'; // Auto-detected local IP on port 3000
const PROD_API_URL = 'https://business-dashboard-api-hvjh.onrender.com/api';

// Set to false when testing with Expo dev client (local server)
const IS_PRODUCTION = true;

export const API_URL = IS_PRODUCTION ? PROD_API_URL : DEV_API_URL;
export const DEBUG_MODE = false; // Set to false for production releases

export const ENDPOINTS = {
  // Auth
  LOGIN: '/users/login',
  REGISTER: '/users/createUser',
  FORGOT_PASSWORD: '/users/forgot-password',
  RESET_PASSWORD: '/users/reset-password',
  ME: '/users/me',

  // Orders
  ORDERS: '/orders',
  CREATE_ORDER: '/orders',
  UPDATE_ORDER_STATUS: (id) => `/orders/${id}/status`,
  ASSIGN_DRIVER: (id) => `/orders/${id}/assign-driver`,
  SUBMIT_POD: (id) => `/orders/${id}/submit-proof`,

  // Customers
  CUSTOMERS: '/customer',
  CREATE_CUSTOMER: '/customer',

  // Products
  PRODUCTS: '/products',
  CREATE_PRODUCT: '/products',

  // Payments / Invoices
  PAYMENTS: '/payments',
  INVOICES: '/invoices',
  PAY_INVOICE: (token) => `/payments/pay-invoice/${token}`,

  // Users (Admin)
  USERS: '/users',
  UPDATE_USER_ROLE: (id) => `/users/${id}/role`,
  DELETE_USER: (id) => `/users/${id}`,

  // GPS / Tracking
  UPDATE_LOCATION: (orderId) => `/orders/${orderId}/update-location`,
  GET_LOCATION: (orderId) => `/orders/${orderId}/location`,

  // Dashboard
  DASHBOARD_STATS: '/dashboard/stats',
};
