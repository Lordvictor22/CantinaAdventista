const db = require('../config/db');

/**
 * Verifica se o usuário logado pode gerenciar determinado aluno.
 *
 * - Admin pode gerenciar qualquer aluno.
 * - Responsável (parent) só pode gerenciar aluno vinculado
 *   na tabela parent_students.
 */
const verifyParentStudent = async (req, studentId) => {
  const parentId = req.user?.id;

  if (!parentId || !studentId) {
    return false;
  }

  // Admin pode gerenciar qualquer aluno
  if (req.user?.role === 'admin') {
    return true;
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


// =====================================================
// 1. LISTAR PRODUTOS BLOQUEADOS DE UM ALUNO
// =====================================================

const getBlockedProducts = async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    return res.status(400).json({
      error: 'ID do aluno é obrigatório.'
    });
  }

  try {
    const allowed = await verifyParentStudent(req, studentId);

    if (!allowed) {
      return res.status(403).json({
        error: 'Você não tem permissão para gerenciar este aluno.'
      });
    }

    const result = await db.query(
      `SELECT product_id
       FROM student_blocked_products
       WHERE student_id = $1`,
      [studentId]
    );

    const blockedIds = result.rows.map(row => Number(row.product_id));

    return res.json(blockedIds);

  } catch (error) {
    console.error('Erro ao buscar produtos bloqueados:', error);

    return res.status(500).json({
      error: 'Erro ao carregar restrições alimentares.'
    });
  }
};


// =====================================================
// 2. DEFINIR / ATUALIZAR LIMITE DIÁRIO
// =====================================================

const setStudentLimit = async (req, res) => {
  const studentId =
    req.body.studentId ||
    req.body.student_id ||
    req.body.id;

  const rawLimit =
    req.body.dailyLimit !== undefined
      ? req.body.dailyLimit
      : req.body.daily_limit;

  if (!studentId) {
    return res.status(400).json({
      error: 'ID do aluno é obrigatório.'
    });
  }

  try {
    // Verifica se o responsável realmente possui vínculo
    const allowed = await verifyParentStudent(req, studentId);

    if (!allowed) {
      return res.status(403).json({
        error: 'Você não tem permissão para gerenciar este aluno.'
      });
    }

    // Converte e valida o limite
    let limitValue = null;

    if (
      rawLimit !== null &&
      rawLimit !== undefined &&
      rawLimit !== ''
    ) {
      limitValue = Number(rawLimit);

      if (!Number.isFinite(limitValue) || limitValue < 0) {
        return res.status(400).json({
          error: 'Valor de limite diário inválido.'
        });
      }
    }

    const result = await db.query(
      `UPDATE users
       SET daily_limit = $1
       WHERE id = $2
         AND role = 'student'
       RETURNING id, name, daily_limit`,
      [limitValue, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Aluno não encontrado ou não possui perfil de estudante.'
      });
    }

    return res.json({
      message: 'Limite diário atualizado com sucesso!',
      student: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao atualizar limite diário:', error);

    return res.status(500).json({
      error: 'Erro ao atualizar limite diário.'
    });
  }
};


// =====================================================
// 3. BLOQUEAR / DESBLOQUEAR PRODUTO
// =====================================================

const toggleBlockProduct = async (req, res) => {
  const { studentId, productId } = req.body;

  if (!studentId || !productId) {
    return res.status(400).json({
      error: 'Aluno e produto são obrigatórios.'
    });
  }

  try {
    // Primeiro verifica o vínculo
    const allowed = await verifyParentStudent(req, studentId);

    if (!allowed) {
      return res.status(403).json({
        error: 'Você não tem permissão para gerenciar este aluno.'
      });
    }

    // Verifica se o produto já está bloqueado
    const check = await db.query(
      `SELECT id
       FROM student_blocked_products
       WHERE student_id = $1
         AND product_id = $2`,
      [studentId, productId]
    );

    // Se já está bloqueado, desbloqueia
    if (check.rows.length > 0) {
      await db.query(
        `DELETE FROM student_blocked_products
         WHERE student_id = $1
           AND product_id = $2`,
        [studentId, productId]
      );

      return res.json({
        message: 'Produto liberado com sucesso!',
        isBlocked: false
      });
    }

    // Caso contrário, bloqueia
    await db.query(
      `INSERT INTO student_blocked_products
       (student_id, product_id)
       VALUES ($1, $2)`,
      [studentId, productId]
    );

    return res.json({
      message: 'Produto bloqueado com sucesso!',
      isBlocked: true
    });

  } catch (error) {
    console.error('Erro ao alterar restrição:', error);

    return res.status(500).json({
      error: 'Erro ao salvar restrição alimentar.'
    });
  }
};


// =====================================================
// 4. VINCULAR FILHO PELO E-MAIL
// =====================================================

const linkStudentByEmail = async (req, res) => {
  const parentId = req.user?.id;
  const { studentEmail } = req.body;

  if (!parentId) {
    return res.status(401).json({
      error: 'Usuário não autenticado.'
    });
  }

  if (!studentEmail) {
    return res.status(400).json({
      error: 'O e-mail do aluno é obrigatório.'
    });
  }

  try {
    const normalizedEmail = studentEmail
      .trim()
      .toLowerCase();

    const studentRes = await db.query(
      `SELECT id, name, email
       FROM users
       WHERE email = $1
         AND role = 'student'`,
      [normalizedEmail]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({
        error: 'Estudante não encontrado com este e-mail.'
      });
    }

    const student = studentRes.rows[0];

    await db.query(
      `INSERT INTO parent_students
       (parent_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (parent_id, student_id)
       DO NOTHING`,
      [parentId, student.id]
    );

    return res.json({
      message: 'Estudante vinculado com sucesso!',
      student
    });

  } catch (error) {
    console.error('Erro ao vincular estudante:', error);

    return res.status(500).json({
      error: 'Erro interno ao vincular estudante.'
    });
  }
};


// =====================================================
// 5. LISTAR FILHOS DO RESPONSÁVEL LOGADO
// =====================================================

const getMyStudents = async (req, res) => {
  const parentId = req.user?.id;

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
         u.balance,
         u.daily_limit,
         u.avatar
       FROM users u
       JOIN parent_students ps
         ON ps.student_id = u.id
       WHERE ps.parent_id = $1
       ORDER BY u.name ASC`,
      [parentId]
    );

    return res.json(result.rows);

  } catch (error) {
    console.error(
      'Erro ao buscar estudantes do responsável:',
      error
    );

    return res.status(500).json({
      error: 'Erro ao carregar lista de estudantes.'
    });
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getBlockedProducts,
  setStudentLimit,
  toggleBlockProduct,
  linkStudentByEmail,
  getMyStudents
};