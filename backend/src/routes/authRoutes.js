const express = require('express');
const router = express.Router();
const { register, login, updateAvatar } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.put('/avatar', updateAvatar); // 👈 Adicione esta linha!

module.exports = router;