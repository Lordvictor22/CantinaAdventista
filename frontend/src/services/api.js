import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://cantinabackend-dvf3.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

// Interceptor de requisição: injeta o JWT e ajusta cabeçalhos dinamicamente
api.interceptors.request.use(
  (config) => {
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
      config.headers['Cache-Control'] = 'no-cache';
      config.headers['Pragma'] = 'no-cache';
    // Se for envio de arquivo (FormData), remove o Content-Type para o Axios/navegador definir o boundary correto
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta: lida com token expirado ou inválido (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Evita loops infinitos de redirecionamento caso já esteja no login
      if (window.location.pathname !== '/login') {
        alert('Sua sessão expirou. Faça login novamente.');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- FUNÇÕES DE PEDIDOS ---
export const createOrder = (orderData) => api.post('/orders', orderData);
export const getUserOrders = () => api.get('/orders/my-orders');

export default api;