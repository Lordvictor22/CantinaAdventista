const express = require('express');
const router = express.Router();

const {
  getBlockedProducts,
  toggleBlockProduct,
  setStudentLimit
} = require('../controllers/parentController');

// 1. Buscar produtos bloqueados de um aluno
router.get('/blocked/:studentId', getBlockedProducts);

// 2. Bloquear ou desbloquear produto
router.post('/toggle-block', toggleBlockProduct);

// 3. Atualizar/Definir limite diário do aluno (Adicionado)
router.post('/student-limit', setStudentLimit);
router.put('/student-limit', setStudentLimit);

module.exports = router;