const express = require('express');

const router = express.Router();

const {
  linkStudent,
  addBalance,
  getWalletInfo,
  getParentStudents,
  getStudentSummary,
  setDailyLimit,
  deleteParentAccount, // <-- Adicione esta linha
  toggleProductBlock,
  getStatement
} = require('../controllers/walletController');

const {
  verifyToken,
  verifyRole
} = require('../middlewares/authMiddleware');


// =========================================
// ROTAS DOS PAIS
// =========================================

// Vincular filho pelo e-mail
router.post(
  '/link',
  verifyToken,
  verifyRole('parent'),
  linkStudent
);


// Buscar todos os filhos vinculados ao pai logado
router.get(
  '/my-students',
  verifyToken,
  verifyRole('parent'),
  getParentStudents
);

// Excluir conta do pai logado
router.delete(
  '/account',
  verifyToken,
  verifyRole('parent'),
  deleteParentAccount
);

// =========================================
// RECARGA
// =========================================

// Pais podem adicionar saldo aos próprios filhos
router.post(
  '/add-balance',
  verifyToken,
  verifyRole('parent', 'admin', 'cashier'),
  addBalance
);


// =========================================
// RESUMO DO ALUNO
// =========================================

router.get(
  '/student/:studentId/summary',
  verifyToken,
  verifyRole('parent', 'admin'),
  getStudentSummary
);


// Definir limite diário
router.put(
  '/student/:studentId/daily-limit',
  verifyToken,
  verifyRole('parent', 'admin'),
  setDailyLimit
);


// Bloquear ou desbloquear produtos
router.post(
  '/student/:studentId/product-block',
  verifyToken,
  verifyRole('parent', 'admin'),
  toggleProductBlock
);


// =========================================
// EXTRATO COMPLETO
// =========================================

router.get(
  '/student/:studentId/statement',
  verifyToken,
  verifyRole('parent', 'student', 'admin', 'cashier'),
  getStatement
);


// =========================================
// CARTEIRA E HISTÓRICO RECENTE
// IMPORTANTE: DEIXAR ESTA ROTA POR ÚLTIMO
// =========================================

router.get(
  '/:studentId',
  verifyToken,
  verifyRole('parent', 'student', 'admin', 'cashier'),
  getWalletInfo
);


module.exports = router;