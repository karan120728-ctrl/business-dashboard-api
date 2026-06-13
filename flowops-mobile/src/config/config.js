// FlowOps API Configuration
// Single source of truth for all API endpoints

const DEV_API_URL = 'http://192.168.1.100:5000/api'; // Replace with your local machine IP when testing
const PROD_API_URL = 'https://business-dashboard-api-hvjh.onrender.com/api';

// Set to false when running locally with npm start
const IS_PRODUCTION = true;

export const API_URL = IS_PRODUCTION ? PROD_API_URL : DEV_API_URL;

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
