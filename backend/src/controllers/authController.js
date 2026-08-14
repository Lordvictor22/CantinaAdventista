const db = require('../config/db');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase().trim(), password, 'student']
    );

    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }
    return res.status(500).json({ error: `Erro no servidor: ${error.message}` });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'chave_secreta_padrao',
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
        avatar: user.avatar || null // 👈 Retorna a foto do aluno no login
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao autenticar no servidor.' });
  }
};

// 📸 NOVA FUNÇÃO: Atualiza a foto de perfil do aluno logado
const updateAvatar = async (req, res) => {
  const { userId, avatar } = req.body;

  if (!userId || !avatar) {
    return res.status(400).json({ error: 'Usuário e imagem são obrigatórios.' });
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

module.exports = { register, login, updateAvatar };