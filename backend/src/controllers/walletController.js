const db = require('../config/db');

// 1. Vincular Pai e Filho
exports.linkStudent = async (req, res) => {
  try {
    const { parent_id, student_email } = req.body;

    // Busca o aluno pelo email
    const studentQuery = await db.query('SELECT id, name FROM users WHERE email = $1', [student_email]);
    if (studentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Aluno não encontrado com este e-mail.' });
    }

    const student_id = studentQuery.rows[0].id;

    // Registra a conexão
    await db.query(
      'INSERT INTO parent_students (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [parent_id, student_id]
    );

    res.json({ message: `Aluno ${studentQuery.rows[0].name} vinculado com sucesso!`, student_id });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao vincular aluno: ' + error.message });
  }
};

// 2. Adicionar Saldo (Recarga)
exports.addBalance = async (req, res) => {
  try {
    const { student_id, amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valor da recarga deve ser maior que zero.' });
    }

    // Atualiza o saldo do aluno
    const updateResult = await db.query(
      'UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2 RETURNING balance, name',
      [amount, student_id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aluno não encontrado.' });
    }

    // Registra a transação no extrato
    await db.query(
      'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [student_id, amount, 'DEPOSIT', description || 'Recarga de saldo realizada pelos pais']
    );

    res.json({
      message: 'Saldo adicionado com sucesso!',
      new_balance: updateResult.rows[0].balance,
      student_name: updateResult.rows[0].name
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar saldo: ' + error.message });
  }
};

// 3. Consultar Saldo e Extrato do Aluno
exports.getWalletInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    // Saldo atual
    const userQuery = await db.query('SELECT id, name, balance FROM users WHERE id = $1', [userId]);
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Histórico de transações (últimas 15)
    const historyQuery = await db.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15',
      [userId]
    );

    res.json({
      user: userQuery.rows[0],
      transactions: historyQuery.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar extrato: ' + error.message });
  }
};


// 1. Buscar os filhos vinculados ao pai logado (req.user.id vem do middleware JWT)
exports.getParentStudents = async (req, res) => {
  const parentId = req.user.id;

  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.balance, u.daily_limit
       FROM parent_students ps
       JOIN users u ON ps.student_id = u.id
       WHERE ps.parent_id = $1`,
      [parentId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar filhos:', error);
    return res.status(500).json({ error: 'Erro ao buscar lista de alunos vinculados.' });
  }
};

// 2. Buscar resumo completo do filho (incluindo lista de produtos bloqueados e extrato)
exports.getStudentSummary = async (req, res) => {
  const { studentId } = req.params;

  try {
    // Dados do aluno
    const studentRes = await db.query(
      'SELECT id, name, email, balance, daily_limit FROM users WHERE id = $1',
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Aluno não encontrado.' });
    }

    // IDs dos produtos bloqueados para este aluno
    const blockedRes = await db.query(
      'SELECT product_id FROM blocked_products WHERE student_id = $1',
      [studentId]
    );
    const blockedProductIds = blockedRes.rows.map(row => Number(row.product_id));

    // Histórico de pedidos do aluno
    const ordersRes = await db.query(
      `SELECT id, total, status, pickup_date, pickup_time, created_at 
       FROM orders 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [studentId]
    );

    return res.json({
      student: studentRes.rows[0],
      blockedProductIds,
      recentOrders: ordersRes.rows
    });
  } catch (error) {
    console.error('Erro ao carregar resumo do aluno:', error);
    return res.status(500).json({ error: 'Erro ao carregar resumo do aluno.' });
  }
};

// 3. Atualizar o limite diário do filho
exports.setDailyLimit = async (req, res) => {
  const { studentId } = req.params;
  const { daily_limit } = req.body; // Pode passar um valor numérico ou null para remover o limite

  try {
    const result = await db.query(
      `UPDATE users 
       SET daily_limit = $1 
       WHERE id = $2 
       RETURNING id, name, daily_limit`,
      [daily_limit !== undefined && daily_limit !== '' ? daily_limit : null, studentId]
    );

    return res.json({
      message: 'Limite diário atualizado com sucesso!',
      student: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao definir limite diário:', error);
    return res.status(500).json({ error: 'Erro ao definir limite diário.' });
  }
};

// 4. Bloquear ou Desbloquear um produto específico para o filho
exports.toggleProductBlock = async (req, res) => {
  const { studentId } = req.params;
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'ID do produto é obrigatório.' });
  }

  try {
    // Verifica se já está bloqueado
    const checkRes = await db.query(
      'SELECT * FROM blocked_products WHERE student_id = $1 AND product_id = $2',
      [studentId, productId]
    );

    if (checkRes.rows.length > 0) {
      // Já está bloqueado -> DESBLOQUEIA
      await db.query(
        'DELETE FROM blocked_products WHERE student_id = $1 AND product_id = $2',
        [studentId, productId]
      );
      return res.json({ message: 'Produto desbloqueado para o aluno.', isBlocked: false });
    } else {
      // Não está bloqueado -> BLOQUEIA
      await db.query(
        'INSERT INTO blocked_products (student_id, product_id) VALUES ($1, $2)',
        [studentId, productId]
      );
      return res.json({ message: 'Produto bloqueado para o aluno com sucesso!', isBlocked: true });
    }
  } catch (error) {
    console.error('Erro ao alternar bloqueio do produto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar restrição de produto.' });
  }
};