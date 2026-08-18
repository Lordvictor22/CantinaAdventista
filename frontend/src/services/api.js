import axios from 'axios';

// URL da API
const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

// Interceptor de requisição: injeta o JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }

    config.headers['Cache-Control'] = 'no-cache';
    config.headers['Pragma'] = 'no-cache';

    // Se for envio de arquivo, deixa o navegador definir o Content-Type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta
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

// ========================================
// FUNÇÕES DA API
// ========================================

// Autenticação
export const loginUser = (credentials) =>
  api.post('/auth/login', credentials);

export const registerUser = (userData) =>
  api.post('/auth/register', userData);

// Pedidos
export const createOrder = (orderData) =>
  api.post('/orders', orderData);

export const getUserOrders = () =>
  api.get('/orders/user');

export const getAllOrders = () =>
  api.get('/orders');

export const updateOrderStatus = (id, status) =>
  api.put(`/orders/${id}/status`, { status });

// Carteira
export const getWalletInfo = (userId) =>
  api.get(`/wallet/info/${userId}`);

export const addBalance = (data) =>
  api.post('/wallet/add-balance', data);

export const getParentStudents = () =>
  api.get('/wallet/parent/students');

export default api;