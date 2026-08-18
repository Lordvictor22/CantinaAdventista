import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:3000/api';

console.log('🌐 API URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      if (window.location.pathname !== '/login') {
        alert('Sua sessão expirou. Faça login novamente.');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const loginUser = (credentials) =>
  api.post('/auth/login', credentials);

export const registerUser = (userData) =>
  api.post('/auth/register', userData);

export const createOrder = (orderData) =>
  api.post('/orders', orderData);

export const getUserOrders = () =>
  api.get('/orders/user');

export const getAllOrders = () =>
  api.get('/orders');

export const updateOrderStatus = (id, status) =>
  api.put(`/orders/${id}/status`, { status });

export const getWalletInfo = (userId) =>
  api.get(`/wallet/info/${userId}`);

export const addBalance = (data) =>
  api.post('/wallet/add-balance', data);

export const getParentStudents = () =>
  api.get('/wallet/parent/students');

export default api; 