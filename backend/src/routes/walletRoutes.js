const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /wallet/:id  -> Busca saldo do aluno
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT id, name, balance FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Erro ao buscar saldo:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar saldo' });
  }
});

// POST /wallet/add-balance -> Adiciona saldo manualmente
router.post('/add-balance', async (req, res) => {
  const { student_id, amount } = req.body;
  if (!student_id || !amount) {
    return res.status(400).json({ error: 'Informe student_id e amount' });
  }
  try {
    await db.query(
      'UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2',
      [amount, student_id]
    );
    return res.json({ message: 'Saldo adicionado com sucesso!' });
  } catch (err) {
    console.error('Erro ao adicionar saldo:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar saldo' });
  }
});

module.exports = router;