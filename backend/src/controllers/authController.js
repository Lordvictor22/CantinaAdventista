const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Regex para validação de e-mail
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// =========================================
// 1. CADASTRO DE USUÁRIO (REGISTRO)
// =========================================
const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  // Aceita tanto terms_accepted (snake_case) quanto acceptedTerms / termsAccepted (camelCase)
  const isTermsAccepted = req.body.terms_accepted || req.body.acceptedTerms || req.body.termsAccepted;

  // Validação do aceite dos termos de uso (LGPD)
  if (!isTermsAccepted) {
    return res.status(400).json({ 
      error: 'É necessário aceitar os Termos de Uso e a Política de Privacidade para se cadastrar.' 
    });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Formato de e-mail inválido.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'A senha deve conter no mínimo 8 caracteres.' });
  }

  // Restrição de auto-cadastro (permite apenas Aluno ou Pai)
  const allowedRoles = ['student', 'parent'];
  const userRole = allowedRoles.includes(role) ? role : 'student';

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      `INSERT INTO users (name, email, password, role, terms_accepted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.toLowerCase().trim(), hashedPassword, userRole]
    );

    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }
    return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
};

// =========================================
// 2. AUTENTICAÇÃO (LOGIN)
// =========================================
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const result = await db.query(
      'SELECT id, name, email, password, role, avatar FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('❌ ERRO CRÍTICO: JWT_SECRET não definida no ambiente!');
      return res.status(500).json({ error: 'Erro interno de configuração de segurança.' });
    }

    // Minimização de dados no Payload do JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao autenticar no servidor.' });
  }
};

// =========================================
// 3. ATUALIZAÇÃO DE AVATAR / FOTO
// =========================================
const updateAvatar = async (req, res) => {
  const { avatar } = req.body;
  const userId = req.user?.id;

  if (!userId || !avatar) {
    return res.status(400).json({ error: 'Usuário não autenticado ou imagem ausente.' });
  }

  try {
    const result = await db.query(
      `UPDATE users SET avatar = $1 WHERE id = $2 RETURNING id, name, email, avatar`,
      [avatar, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({
      message: 'Foto de perfil atualizada com sucesso!',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar avatar:', error);
    return res.status(500).json({ error: 'Erro ao salvar foto no banco de dados.' });
  }
};

// =========================================
// 4. EXCLUSÃO/PSEUDONIMIZAÇÃO DE CONTA (LGPD)
// =========================================
const deleteAccount = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Usuário não autenticado.' });

  try {
    // Invalida a senha com um hash aleatório impossível de autenticar
    const randomSeed = `deleted-${userId}-${Date.now()}`;
    const hashed = await bcrypt.hash(randomSeed, 10);

    // Pseudonimiza dados pessoais do usuário
    await db.query(
      `UPDATE users 
       SET name = '[REMOVIDO]', 
           email = CONCAT('deleted+', id, '@removed.local'), 
           password = $1, 
           avatar = NULL 
       WHERE id = $2`,
      [hashed, userId]
    );

    // Registra log sem exposição de dados
    try {
      await db.query(
        `INSERT INTO logs (user_id, action, details, created_at) VALUES ($1, $2, $3, NOW())`,
        [userId, 'account_deleted', 'Usuário solicitou remoção de dados pessoais - pseudonimizado']
      );
    } catch (logErr) {
      console.warn('Falha ao registrar log de exclusão:', logErr);
    }

    return res.json({ 
      message: 'Solicitação atendida: dados pessoais removidos quando permitido. Registros técnicos necessários podem ser retidos por obrigações legais.' 
    });
  } catch (err) {
    console.error('Erro ao excluir conta:', err);
    return res.status(500).json({ error: 'Erro ao processar exclusão da conta.' });
  }
};

module.exports = { 
  register, 
  login, 
  updateAvatar, 
  deleteAccount 
};