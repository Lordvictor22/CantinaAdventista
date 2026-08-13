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