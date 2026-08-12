const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Qualquer usuário autenticado pode criar um pedido
router.post('/', verifyToken, orderController.createOrder);

// Qualquer usuário autenticado pode ver seu próprio histórico
router.get('/my-orders', verifyToken, orderController.getUserOrders);

// Apenas perfis autorizados (cashier, canteen, admin) podem listar e atualizar pedidos
router.get('/', verifyToken, verifyRole('cashier', 'canteen', 'admin'), orderController.getOrders);
router.patch('/:id/status', verifyToken, verifyRole('cashier', 'canteen', 'admin'), orderController.updateOrderStatus);
router.put('/:id/status', verifyToken, verifyRole('cashier', 'canteen', 'admin'), orderController.updateOrderStatus);

// Alias de suporte para a rota /cashier
router.get('/cashier', (req, res) => {
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(307, '/orders' + queryString);
});

module.exports = router;