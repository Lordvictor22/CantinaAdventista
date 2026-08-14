const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Qualquer pessoa pode visualizar os produtos
router.get('/', productController.getProducts);

// Apenas cantina e admin podem gerenciar produtos
router.post(
  '/',
  verifyToken,
  verifyRole('canteen', 'admin', 'cashier'),
  productController.createProduct
);

router.put(
  '/:id',
  verifyToken,
  verifyRole('canteen', 'admin', 'cashier'),
  productController.updateProduct
);

// 🟢 ROTA NOVA: Alternar / Desativar status do produto
router.patch(
  '/:id/status',
  verifyToken,
  verifyRole('canteen', 'admin', 'cashier'),
  productController.toggleProductStatus
);

router.delete(
  '/:id',
  verifyToken,
  verifyRole('canteen', 'admin', 'cashier'),
  productController.deleteProduct
);

module.exports = router;