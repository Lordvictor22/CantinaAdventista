const db = require('../config/db');

// =========================================
// AUXILIAR: VERIFICA SE O PAI TEM ACESSO AO ALUNO
// =========================================
const verifyParentAccess = async (parentId, studentId) => {
  if (!parentId || !studentId) {
    return false;
  }

  const result = await db.query(
    `SELECT 1
     FROM parent_students
     WHERE parent_id = $1
       AND student_id = $2`,
    [parentId, studentId]
  );

  return result.rows.length > 0;
};

// =========================================
// AUXILIAR: VALIDAR ID NUMÉRICO
// =========================================
const parsePositiveId = (value) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

// =========================================
// 1. VINCULAR PAI E FILHO
// =========================================
const linkStudent = async (req, res) => {
  try {
    const parentId = parsePositiveId(req.user?.id);
    const { student_email } = req.body;

    if (!parentId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.'
      });
    }

    if (!student_email || !String(student_email).trim()) {
      return res.status(400).json({
        error: 'E-mail do aluno é obrigatório.'
      });
    }

    const email = String(student_email).trim().toLowerCase();

    // Busca somente usuários com perfil de estudante
    const studentQuery = await db.query(
      `SELECT id, name, email
       FROM users
       WHERE email = $1
         AND role = 'student'`,
      [email]
    );

    if (studentQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado com este e-mail.'
      });
    }

    const student = studentQuery.rows[0];

    // Impede vincular a própria conta
    if (String(parentId) === String(student.id)) {
      return res.status(400).json({
        error: 'Não é possível vincular a própria conta.'
      });
    }

    const linkResult = await db.query(
      `INSERT INTO parent_students (parent_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (parent_id, student_id)
       DO NOTHING
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
  const studentId = parsePositiveId(req.body.student_id);
  const requesterId = parsePositiveId(req.user?.id);
  const requesterRole = req.user?.role;

  const numericAmount = Number(req.body.amount);
  const description =
    req.body.description?.trim() || 'Recarga de saldo';

  if (!requesterId) {
    return res.status(401).json({
      error: 'Usuário não autenticado.'
    });
  }

  if (!studentId) {
    return res.status(400).json({
      error: 'ID do aluno é obrigatório.'
    });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({
      error: 'Valor da recarga deve ser maior que zero.'
    });
  }

  // Evita valores absurdamente grandes
  if (numericAmount > 1000000) {
    return res.status(400).json({
      error: 'Valor da recarga excede o limite permitido.'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // =========================================
    // VERIFICAR PERMISSÃO
    // =========================================

    if (requesterRole === 'parent') {
      const accessCheck = await client.query(
        `SELECT 1
         FROM parent_students
         WHERE parent_id = $1
           AND student_id = $2`,
        [requesterId, studentId]
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

    // =========================================
    // ATUALIZAR SALDO
    // FOR UPDATE IMPLÍCITO PELO UPDATE
    // =========================================
    const updateResult = await client.query(
      `UPDATE users
       SET balance = COALESCE(balance, 0) + $1
       WHERE id = $2
         AND role = 'student'
       RETURNING id, name, balance`,
      [numericAmount, studentId]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Aluno não encontrado.'
      });
    }

    // =========================================
    // REGISTRAR TRANSAÇÃO
    // =========================================
    await client.query(
      `INSERT INTO transactions
       (user_id, amount, type, description)
       VALUES ($1, $2, $3, $4)`,
      [
        studentId,
        numericAmount,
        'DEPOSIT',
        description
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
// 3. CONSULTAR SALDO E HISTÓRICO RECENTE
// =========================================
const getWalletInfo = async (req, res) => {
  try {
    const studentId = parsePositiveId(req.params.studentId);
    const requesterId = parsePositiveId(req.user?.id);
    const requesterRole = req.user?.role;

    if (!requesterId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.'
      });
    }

    if (!studentId) {
      return res.status(400).json({
        error: 'ID do aluno inválido.'
      });
    }

    // =========================================
    // ALUNO → SOMENTE A PRÓPRIA CARTEIRA
    // =========================================
    if (requesterRole === 'student') {
      if (requesterId !== studentId) {
        return res.status(403).json({
          error: 'Você não tem permissão para acessar esta carteira.'
        });
      }
    }

    // =========================================
    // PAI → SOMENTE FILHOS VINCULADOS
    // =========================================
    else if (requesterRole === 'parent') {
      const hasAccess = await verifyParentAccess(
        requesterId,
        studentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acesso negado às informações financeiras.'
        });
      }
    }

    // =========================================
    // ADMIN / CASHIER → PERMITIDOS
    // =========================================
    else if (
      requesterRole !== 'admin' &&
      requesterRole !== 'cashier'
    ) {
      return res.status(403).json({
        error: 'Você não tem permissão para acessar esta carteira.'
      });
    }

    const userQuery = await db.query(
      `SELECT id, name, email, balance
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
  const parentId = parsePositiveId(req.user?.id);

  if (!parentId) {
    return res.status(401).json({
      error: 'Usuário não autenticado.'
    });
  }

  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         COALESCE(u.balance, 0) AS balance,
         u.daily_limit,
         u.avatar
       FROM parent_students ps
       JOIN users u
         ON ps.student_id = u.id
       WHERE ps.parent_id = $1
         AND u.role = 'student'
       ORDER BY u.name ASC`,
      [parentId]
    );

    return res.json(
      result.rows.map(student => ({
        ...student,
        balance: Number(student.balance || 0)
      }))
    );

  } catch (error) {
    console.error('Erro ao buscar filhos:', error);

    return res.status(500).json({
      error: 'Erro ao buscar lista de alunos vinculados.'
    });
  }
};

// =========================================
// 5. RESUMO DO ALUNO
// =========================================
const getStudentSummary = async (req, res) => {
  const studentId = parsePositiveId(req.params.studentId);
  const requesterId = parsePositiveId(req.user?.id);
  const requesterRole = req.user?.role;

  if (!requesterId) {
    return res.status(401).json({
      error: 'Usuário não autenticado.'
    });
  }

  if (!studentId) {
    return res.status(400).json({
      error: 'ID do aluno inválido.'
    });
  }

  try {
    // =========================================
    // PAI → PRECISA TER VÍNCULO
    // ADMIN → PODE ACESSAR
    // =========================================
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
      `SELECT
         id,
         name,
         email,
         balance,
         daily_limit,
         avatar
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

    // IMPORTANTE:
    // Usa a mesma tabela utilizada pelo orderController.
    const blockedRes = await db.query(
      `SELECT product_id
       FROM student_blocked_products
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

    const student = studentRes.rows[0];

    return res.json({
      student: {
        ...student,
        balance: Number(student.balance || 0)
      },

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
  const studentId = parsePositiveId(req.params.studentId);
  const requesterId = parsePositiveId(req.user?.id);
  const requesterRole = req.user?.role;

  if (!requesterId) {
    return res.status(401).json({
      error: 'Usuário não autenticado.'
    });
  }

  if (!studentId) {
    return res.status(400).json({
      error: 'ID do aluno inválido.'
    });
  }

  // Aceita:
  // { dailyLimit: 50 }
  // ou
  // { daily_limit: 50 }
  const dailyLimitRaw =
    req.body.dailyLimit ?? req.body.daily_limit;

  // null ou "" remove o limite
  const dailyLimit =
    dailyLimitRaw === null ||
    dailyLimitRaw === ''
      ? null
      : Number(dailyLimitRaw);

  if (
    dailyLimit !== null &&
    (!Number.isFinite(dailyLimit) || dailyLimit < 0)
  ) {
    return res.status(400).json({
      error: 'O limite diário deve ser um número maior ou igual a zero.'
    });
  }

  try {
    // =========================================
    // PAI → SOMENTE FILHOS VINCULADOS
    // =========================================
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
  const parentId = parsePositiveId(req.user?.id);

  if (!parentId) {
    return res.status(401).json({
      error: 'Usuário não autenticado.'
    });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Confirma que a conta realmente é de um pai
    const parentCheck = await client.query(
      `SELECT id
       FROM users
       WHERE id = $1
         AND role = 'parent'
       FOR UPDATE`,
      [parentId]
    );

    if (parentCheck.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Usuário não encontrado ou não é um responsável.'
      });
    }

    // Remove os vínculos
    await client.query(
      `DELETE FROM parent_students
       WHERE parent_id = $1`,
      [parentId]
    );

    // Remove a conta
    const result = await client.query(
      `DELETE FROM users
       WHERE id = $1
         AND role = 'parent'
       RETURNING id`,
      [parentId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Usuário não encontrado.'
      });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Conta excluída com sucesso.'
    });

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Erro ao excluir conta do pai:', error);

    return res.status(500).json({
      error: 'Erro interno ao tentar excluir a conta.'
    });

  } finally {
    client.release();
  }
};

// =========================================
// 8. BLOQUEAR / DESBLOQUEAR PRODUTO
// =========================================
const toggleProductBlock = async (req, res) => {
  const studentId = parsePositiveId(req.params.studentId);
  const productId = parsePositiveId(req.body.productId);

  const requesterId = parsePositiveId(req.user?.id);
  const requesterRole = req.user?.role;

  if (!requesterId) {
    return res.status(401).json({
      error: 'Usuário não autenticado.'
    });
  }

  if (!studentId) {
    return res.status(400).json({
      error: 'ID do aluno inválido.'
    });
  }

  if (!productId) {
    return res.status(400).json({
      error: 'ID do produto é obrigatório.'
    });
  }

  try {
    // =========================================
    // PAI → PRECISA TER VÍNCULO
    // =========================================
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

    // =========================================
    // CONFIRMAR QUE O ALUNO EXISTE
    // =========================================
    const studentCheck = await db.query(
      `SELECT 1
       FROM users
       WHERE id = $1
         AND role = 'student'`,
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado.'
      });
    }

    // =========================================
    // CONFIRMAR QUE O PRODUTO EXISTE
    // =========================================
    const productCheck = await db.query(
      `SELECT id, name
       FROM products
       WHERE id = $1`,
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Produto não encontrado.'
      });
    }

    // =========================================
    // VERIFICAR SE JÁ ESTÁ BLOQUEADO
    // =========================================
    const checkRes = await db.query(
      `SELECT 1
       FROM student_blocked_products
       WHERE student_id = $1
         AND product_id = $2`,
      [studentId, productId]
    );

    // =========================================
    // DESBLOQUEAR
    // =========================================
    if (checkRes.rows.length > 0) {
      await db.query(
        `DELETE FROM student_blocked_products
         WHERE student_id = $1
           AND product_id = $2`,
        [studentId, productId]
      );

      return res.json({
        message: 'Produto desbloqueado para o aluno.',
        isBlocked: false
      });
    }

    // =========================================
    // BLOQUEAR
    // =========================================
    await db.query(
      `INSERT INTO student_blocked_products
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
    const studentId = parsePositiveId(req.params.studentId);
    const requesterId = parsePositiveId(req.user?.id);
    const requesterRole = req.user?.role;

    if (!requesterId) {
      return res.status(401).json({
        error: 'Usuário não autenticado.'
      });
    }

    if (!studentId) {
      return res.status(400).json({
        error: 'ID do aluno inválido.'
      });
    }

    // =========================================
    // ALUNO → SOMENTE PRÓPRIO EXTRATO
    // =========================================
    if (requesterRole === 'student') {
      if (requesterId !== studentId) {
        return res.status(403).json({
          error: 'Acesso negado às informações financeiras.'
        });
      }
    }

    // =========================================
    // PAI → SOMENTE FILHO VINCULADO
    // =========================================
    else if (requesterRole === 'parent') {
      const hasAccess = await verifyParentAccess(
        requesterId,
        studentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Acesso negado às informações financeiras.'
        });
      }
    }

    // =========================================
    // ADMIN / CASHIER
    // =========================================
    else if (
      requesterRole !== 'admin' &&
      requesterRole !== 'cashier'
    ) {
      return res.status(403).json({
        error: 'Acesso negado.'
      });
    }

    // =========================================
    // BUSCAR ALUNO
    // =========================================
    const userQuery = await db.query(
      `SELECT id, name, email, balance
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

    // =========================================
    // PAGINAÇÃO
    // =========================================
    let limit = Number(req.query.limit);
    let offset = Number(req.query.offset);

    if (!Number.isFinite(limit)) {
      limit = 100;
    }

    if (!Number.isFinite(offset)) {
      offset = 0;
    }

    limit = Math.max(
      1,
      Math.min(1000, Math.floor(limit))
    );

    offset = Math.max(
      0,
      Math.floor(offset)
    );

    // =========================================
    // BUSCAR TRANSAÇÕES
    // =========================================
    const txRes = await db.query(
      `SELECT
         id,
         amount,
         type,
         description,
         created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2
       OFFSET $3`,
      [studentId, limit, offset]
    );

    return res.json({
      current_balance: Number(
        userQuery.rows[0].balance || 0
      ),
      transactions: txRes.rows
    });

  } catch (error) {
    console.error('Erro ao buscar extrato:', error);

    return res.status(500).json({
      error: 'Erro ao buscar extrato.'
    });
  }
};

// =========================================
// EXPORTS
// =========================================
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