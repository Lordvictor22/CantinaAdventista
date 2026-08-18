const express = require('express');
const router = express.Router();
const { register, login, updateAvatar, deleteAccount } = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.put('/avatar', verifyToken, updateAvatar);
// Exclusão de conta (requer token do usuário) — pseudonimização aplicada no servidor
router.delete('/delete', verifyToken, deleteAccount);

module.exports = router;