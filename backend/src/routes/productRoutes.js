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

// Remova o '/status' para bater com o que o Frontend está chamando
router.patch(
  '/:id',
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