const express = require('express');

const router = express.Router();

const {
  register,
  login,
  updateAvatar,
  deleteAccount
} = require('../controllers/authController');

const {
  verifyToken
} = require('../middlewares/authMiddleware');


// =========================================
// AUTENTICAÇÃO
// =========================================

router.post('/register', register);

router.post('/login', login);


// =========================================
// USUÁRIO AUTENTICADO
// =========================================

// Atualizar avatar
router.put(
  '/avatar',
  verifyToken,
  updateAvatar
);

// Excluir conta
router.delete(
  '/delete',
  verifyToken,
  deleteAccount
);


module.exports = router;