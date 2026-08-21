import axios from 'axios';

const API_URL =
  import.meta.env.MODE === 'production'
    ? 'https://cantinabackend-dvf3.onrender.com/api'
    : 'http://127.0.0.1:3000/api';

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

// =========================
// AUTENTICAÇÃO
// =========================

export const loginUser = (credentials) =>
  api.post('/auth/login', credentials);

export const registerUser = (userData) =>
  api.post('/auth/register', userData);

// =========================
// PEDIDOS
// =========================

export const createOrder = (orderData) =>
  api.post('/orders', orderData);

export const getUserOrders = () =>
  api.get('/orders/my-orders');

export const getAllOrders = () =>
  api.get('/orders');

export const updateOrderStatus = (id, status) =>
  api.put(`/orders/${id}/status`, { status });

// =========================
// CARTEIRA
// =========================

export const getWalletInfo = (userId) =>
  api.get(`/wallet/info/${userId}`);

export const addBalance = (data) =>
  api.post('/wallet/add-balance', data);

export const getParentStudents = () =>
  api.get('/wallet/parent/students');

// =========================
// RESPONSÁVEL / ALUNO
// =========================

export const getBlockedProducts = (studentId) =>
  api.get(`/parent/blocked/${studentId}`);

export const toggleBlockProduct = (data) =>
  api.post('/parent/toggle-block', data);

export const setStudentLimit = (data) =>
  api.post('/parent/student-limit', data);

export const updateStudentLimit = (data) =>
  api.put('/parent/student-limit', data);

export default api;