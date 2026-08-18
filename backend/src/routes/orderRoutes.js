const express = require('express');
const router = express.Router();
const { 
  createOrder, 
  getUserOrders, 
  getAllOrders, 
  updateOrderStatus,
  refundOrder
} = require('../controllers/orderController'); // Ajuste o caminho se necessário
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// Rota para o aluno criar o pedido
router.post('/', verifyToken, createOrder);

// Rota essencial: Busca apenas os pedidos do aluno logado
router.get('/user', verifyToken, getUserOrders);

// Rotas administrativas / cantina
router.get('/', verifyToken, verifyAdmin, getAllOrders);
router.patch('/:id/status', verifyToken, verifyAdmin, updateOrderStatus);

// Estorno de pedido (pode ser requisitado pelo dono do pedido ou admin)
router.post('/:id/refund', verifyToken, refundOrder);

module.exports = router;