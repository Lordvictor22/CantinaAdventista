const db = require('../config/db');

// 1. Listar os IDs dos produtos bloqueados para um aluno
const getBlockedProducts = async (req, res) => {
  const { studentId } = req.params;

  try {
    const result = await db.query(
      'SELECT product_id FROM student_blocked_products WHERE student_id = $1',
      [studentId]
    );

    // Retorna um array simples de IDs: [1, 5, 8]
    const blockedIds = result.rows.map(row => row.product_id);
    return res.json(blockedIds);
  } catch (error) {
    console.error('Erro ao buscar produtos bloqueados:', error);
    return res.status(500).json({ error: 'Erro ao carregar restrições alimentares.' });
  }
};

// 2. Alternar bloqueio (Bloquear/Desbloquear um produto)
const toggleBlockProduct = async (req, res) => {
  const { studentId, productId } = req.body;

  if (!studentId || !productId) {
    return res.status(400).json({ error: 'Aluno e produto são obrigatórios.' });
  }

  try {
    // Verifica se já está bloqueado
    const check = await db.query(
      'SELECT id FROM student_blocked_products WHERE student_id = $1 AND product_id = $2',
      [studentId, productId]
    );

    if (check.rows.length > 0) {
      // Se já existe, remove do bloqueio (Desbloqueia)
      await db.query(
        'DELETE FROM student_blocked_products WHERE student_id = $1 AND product_id = $2',
        [studentId, productId]
      );
      return res.json({ message: 'Produto liberado com sucesso!', isBlocked: false });
    } else {
      // Se não existe, adiciona no bloqueio (Bloqueia)
      await db.query(
        'INSERT INTO student_blocked_products (student_id, product_id) VALUES ($1, $2)',
        [studentId, productId]
      );
      return res.json({ message: 'Produto bloqueado com sucesso!', isBlocked: true });
    }
  } catch (error) {
    console.error('Erro ao alterar restrição:', error);
    return res.status(500).json({ error: 'Erro ao salvar restrição alimentar.' });
  }
};

module.exports = { getBlockedProducts, toggleBlockProduct };