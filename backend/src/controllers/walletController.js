const db = require('../config/db');


// =========================================
// AUXILIAR: VERIFICA SE O PAI TEM ACESSO AO ALUNO
// =========================================
const verifyParentAccess = async (parentId, studentId) => {
  const check = await db.query(
    `SELECT 1
     FROM parent_students
     WHERE parent_id = $1 AND student_id = $2`,
    [parentId, studentId]
  );

  return check.rows.length > 0;
};


// =========================================
// 1. VINCULAR PAI E FILHO
// =========================================
const linkStudent = async (req, res) => {
  try {
    const parentId = req.user.id;
    const { student_email } = req.body;

    if (!student_email || !student_email.trim()) {
      return res.status(400).json({
        error: 'E-mail do aluno é obrigatório.'
      });
    }

    // Busca apenas usuários que realmente são alunos
    const studentQuery = await db.query(
      `SELECT id, name, email
       FROM users
       WHERE email = $1
       AND role = 'student'`,
      [student_email.toLowerCase().trim()]
    );

    if (studentQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado com este e-mail.'
      });
    }

    const student = studentQuery.rows[0];

    // Evita qualquer situação estranha de vincular a própria conta
    if (String(parentId) === String(student.id)) {
      return res.status(400).json({
        error: 'Não é possível vincular a própria conta.'
      });
    }

    const linkResult = await db.query(
      `INSERT INTO parent_students (parent_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (parent_id, student_id) DO NOTHING
       RETURNING parent_id, student_id`,
      [parentId, student.id]
    );

    const alreadyLinked = linkResult.rows.length === 0;

    return res.json({
      message: alreadyLinked
        ? `${student.name} já está vinculado à sua conta.`
        : `Aluno ${student.name} vinculado com sucesso!`,
      student_id: student.id,
      student_name: student.name,
      already_linked: alreadyLinked
    });

  } catch (error) {
    console.error('Erro ao vincular aluno:', error);

    return res.status(500).json({
      error: 'Erro ao vincular aluno.'
    });
  }
};


// =========================================
// 2. ADICIONAR SALDO
// =========================================
const addBalance = async (req, res) => {
  const { student_id, amount, description } = req.body;
  const requesterId = req.user.id;
  const requesterRole = req.user.role;

  const numericAmount = Number(amount);

  if (!student_id) {
    return res.status(400).json({
      error: 'Aluno é obrigatório.'
    });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      error: 'Valor da recarga deve ser maior que zero.'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Se for pai, obrigatoriamente precisa estar vinculado ao aluno
    if (requesterRole === 'parent') {
      const accessCheck = await client.query(
        `SELECT 1
         FROM parent_students
         WHERE parent_id = $1 AND student_id = $2`,
        [requesterId, student_id]
      );

      if (accessCheck.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(403).json({
          error: 'Você não tem permissão para adicionar saldo para este aluno.'
        });
      }
    } else if (
      requesterRole !== 'admin' &&
      requesterRole !== 'cashier'
    ) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'Você não tem permissão para adicionar saldo.'
      });
    }

    // Confirma que o destino é realmente um aluno
    const updateResult = await client.query(
      `UPDATE users
       SET balance = COALESCE(balance, 0) + $1
       WHERE id = $2
       AND role = 'student'
       RETURNING id, balance, name`,
      [numericAmount, student_id]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Aluno não encontrado.'
      });
    }

    await client.query(
      `INSERT INTO transactions
       (user_id, amount, type, description)
       VALUES ($1, $2, $3, $4)`,
      [
        student_id,
        numericAmount,
        'DEPOSIT',
        description || 'Recarga de saldo'
      ]
    );

    await client.query('COMMIT');

    return res.json({
      message: 'Saldo adicionado com sucesso!',
      new_balance: Number(updateResult.rows[0].balance),
      student_name: updateResult.rows[0].name
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Erro ao adicionar saldo:', error);

    return res.status(500).json({
      error: 'Erro ao adicionar saldo.'
    });

  } finally {
    client.release();
  }
};


// =========================================
// 3. CONSULTAR SALDO E EXTRATO
// =========================================
const getWalletInfo = async (req, res) => {
  try {
    const { studentId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Aluno só pode consultar a própria carteira
    if (requesterRole === 'student') {
      if (String(requesterId) !== String(studentId)) {
        return res.status(403).json({
          error: 'Você não tem permissão para acessar esta carteira.'
        });
      }
    }

    // Pai só pode consultar aluno vinculado
    if (requesterRole === 'parent') {
      const isParent = await verifyParentAccess(
        requesterId,
        studentId
      );

      if (!isParent) {
        return res.status(403).json({
          error: 'Acesso negado às informações financeiras.'
        });
      }
    }

    // Outros perfis autorizados
    if (
      requesterRole !== 'student' &&
      requesterRole !== 'parent' &&
      requesterRole !== 'admin' &&
      requesterRole !== 'cashier'
    ) {
      return res.status(403).json({
        error: 'Você não tem permissão para acessar esta carteira.'
      });
    }

    const userQuery = await db.query(
      `SELECT id, name, balance
       FROM users
       WHERE id = $1
       AND role = 'student'`,
      [studentId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado.'
      });
    }

    const historyQuery = await db.query(
      `SELECT id, amount, type, description, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [studentId]
    );

    const student = userQuery.rows[0];
    const numericBalance = Number(student.balance || 0);

    return res.json({
      balance: numericBalance,

      user: {
        ...student,
        balance: numericBalance
      },

      transactions: historyQuery.rows
    });

  } catch (error) {
    console.error('Erro ao buscar carteira:', error);

    return res.status(500).json({
      error: 'Erro ao buscar extrato.'
    });
  }
};


// =========================================
// 4. BUSCAR FILHOS DO PAI LOGADO
// =========================================
const getParentStudents = async (req, res) => {
  const parentId = req.user.id;

  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         COALESCE(u.balance, 0) AS balance,
         u.daily_limit
       FROM parent_students ps
       JOIN users u ON ps.student_id = u.id
       WHERE ps.parent_id = $1
       AND u.role = 'student'
       ORDER BY u.name ASC`,
      [parentId]
    );

    return res.json(result.rows);

  } catch (error) {
    console.error('Erro ao buscar filhos:', error);

    return res.status(500).json({
      error: 'Erro ao buscar lista de alunos vinculados.'
    });
  }
};


// =========================================
// 5. RESUMO DO FILHO
// =========================================
const getStudentSummary = async (req, res) => {
  const { studentId } = req.params;
  const requesterId = req.user.id;
  const requesterRole = req.user.role;

  try {
    if (requesterRole === 'parent') {
      const hasAccess = await verifyParentAccess(
        requesterId,
        studentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acesso negado a este aluno.'
        });
      }
    } else if (requesterRole !== 'admin') {
      return res.status(403).json({
        error: 'Você não tem permissão para acessar este aluno.'
      });
    }

    const studentRes = await db.query(
      `SELECT id, name, email, balance, daily_limit
       FROM users
       WHERE id = $1
       AND role = 'student'`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado.'
      });
    }

    const blockedRes = await db.query(
      `SELECT product_id
       FROM blocked_products
       WHERE student_id = $1`,
      [studentId]
    );

    const blockedProductIds = blockedRes.rows.map(
      row => Number(row.product_id)
    );

    const ordersRes = await db.query(
      `SELECT
         id,
         total,
         status,
         pickup_date,
         pickup_time,
         created_at
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
    console.error('Erro ao carregar resumo:', error);

    return res.status(500).json({
      error: 'Erro ao carregar resumo do aluno.'
    });
  }
};


// =========================================
// 6. DEFINIR LIMITE DIÁRIO
// =========================================
const setDailyLimit = async (req, res) => {
  console.log('==========================================');
  console.log('🔥 SET DAILY LIMIT FOI CHAMADO');
  console.log('studentId:', req.params.studentId);
  console.log('body inteiro:', req.body);
  console.log('requesterId:', req.user?.id);
  console.log('requesterRole:', req.user?.role);
  console.log('==========================================');

  try {
    const studentId = Number(req.params.studentId);

    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Aceita dailyLimit ou daily_limit
    const dailyLimitRaw =
      req.body.dailyLimit ?? req.body.daily_limit;

    // Permite remover o limite enviando null ou ""
    const dailyLimit =
      dailyLimitRaw === null || dailyLimitRaw === ''
        ? null
        : Number(dailyLimitRaw);

    // -----------------------------------------
    // VALIDAR ID
    // -----------------------------------------
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({
        error: 'ID do aluno inválido.'
      });
    }

    // -----------------------------------------
    // VALIDAR LIMITE
    // -----------------------------------------
    if (
      dailyLimit !== null &&
      (!Number.isFinite(dailyLimit) || dailyLimit < 0)
    ) {
      return res.status(400).json({
        error: 'O limite diário deve ser um número maior ou igual a zero.'
      });
    }

    // -----------------------------------------
    // VERIFICAR PERMISSÃO DO PAI
    // -----------------------------------------
    if (requesterRole === 'parent') {

      const hasAccess = await verifyParentAccess(
        requesterId,
        studentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Permissão negada para alterar limites deste aluno.'
        });
      }

    } else if (requesterRole !== 'admin') {

      return res.status(403).json({
        error: 'Você não tem permissão para alterar limites.'
      });

    }

    // -----------------------------------------
    // ATUALIZAR LIMITE
    // -----------------------------------------
    const result = await db.query(
      `UPDATE users
       SET daily_limit = $1
       WHERE id = $2
       AND role = 'student'
       RETURNING id, name, daily_limit`,
      [dailyLimit, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado.'
      });
    }

    console.log(
      '✅ LIMITE ATUALIZADO:',
      result.rows[0]
    );

    return res.json({
      message: 'Limite diário atualizado com sucesso!',
      student: result.rows[0]
    });

  } catch (error) {

    console.error('Erro ao definir limite:', error);

    return res.status(500).json({
      error: 'Erro ao definir limite diário.'
    });
  }
};

// =========================================
// 7. EXCLUIR CONTA DO PAI
// =========================================
const deleteParentAccount = async (req, res) => {
  const parentId = req.user.id;

  try {
    // 1. Remove os vínculos na tabela de associação usando "db"
    await db.query('DELETE FROM parent_students WHERE parent_id = $1', [parentId]);

    // 2. Apaga a conta do pai da tabela de usuários
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id',
      [parentId, 'parent']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou não possui permissão.' });
    }

    return res.status(200).json({ message: 'Conta excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir conta do pai:', error);
    return res.status(500).json({ error: 'Erro interno ao tentar excluir a conta.' });
  }
};


// =========================================
// 8. BLOQUEAR / DESBLOQUEAR PRODUTO
// =========================================
const toggleProductBlock = async (req, res) => {
  const { studentId } = req.params;
  const { productId } = req.body;
  const requesterId = req.user.id;
  const requesterRole = req.user.role;

  if (!productId) {
    return res.status(400).json({
      error: 'ID do produto é obrigatório.'
    });
  }

  try {
    if (requesterRole === 'parent') {
      const hasAccess = await verifyParentAccess(
        requesterId,
        studentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Permissão negada para alterar bloqueios deste aluno.'
        });
      }
    } else if (requesterRole !== 'admin') {
      return res.status(403).json({
        error: 'Você não tem permissão para alterar bloqueios.'
      });
    }

    const checkRes = await db.query(
      `SELECT 1
       FROM blocked_products
       WHERE student_id = $1
       AND product_id = $2`,
      [studentId, productId]
    );

    if (checkRes.rows.length > 0) {
      await db.query(
        `DELETE FROM blocked_products
         WHERE student_id = $1
         AND product_id = $2`,
        [studentId, productId]
      );

      return res.json({
        message: 'Produto desbloqueado para o aluno.',
        isBlocked: false
      });
    }

    await db.query(
      `INSERT INTO blocked_products
       (student_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [studentId, productId]
    );

    return res.json({
      message: 'Produto bloqueado com sucesso!',
      isBlocked: true
    });

  } catch (error) {
    console.error('Erro ao atualizar bloqueio:', error);

    return res.status(500).json({
      error: 'Erro ao atualizar restrição de produto.'
    });
  }
};


// =========================================
// 9. EXTRATO COMPLETO
// =========================================
const getStatement = async (req, res) => {
  try {
    const { studentId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (requesterRole === 'student') {
      if (String(requesterId) !== String(studentId)) {
        return res.status(403).json({
          error: 'Acesso negado às informações financeiras.'
        });
      }
    } else if (requesterRole === 'parent') {
      const hasAccess = await verifyParentAccess(
        requesterId,
        studentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acesso negado às informações financeiras.'
        });
      }
    } else if (
      requesterRole !== 'admin' &&
      requesterRole !== 'cashier'
    ) {
      return res.status(403).json({
        error: 'Acesso negado.'
      });
    }

    const userQuery = await db.query(
      `SELECT id, name, balance
       FROM users
       WHERE id = $1
       AND role = 'student'`,
      [studentId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado.'
      });
    }

    let limit = Number(req.query.limit) || 100;
    let offset = Number(req.query.offset) || 0;

    limit = Math.max(1, Math.min(1000, limit));
    offset = Math.max(0, offset);

    const txRes = await db.query(
      `SELECT id, amount, type, description, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [studentId, limit, offset]
    );

    return res.json({
      current_balance: Number(userQuery.rows[0].balance || 0),
      transactions: txRes.rows
    });

  } catch (error) {
    console.error('Erro ao buscar extrato:', error);

    return res.status(500).json({
      error: 'Erro ao buscar extrato.'
    });
  }
};


module.exports = {
  linkStudent,
  addBalance,
  getWalletInfo,
  getParentStudents,
  getStudentSummary,
  setDailyLimit,
  deleteParentAccount,
  toggleProductBlock,
  getStatement
};