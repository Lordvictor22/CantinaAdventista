const db = require('../config/db');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  const { name, email, password } = req.body; // Removemos o 'role' da desestruturação

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase().trim(), password, 'student'] // BLINDADO: Todo cadastro público é obrigatoriamente 'student'
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
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao autenticar no servidor.' });
  }
};

module.exports = { register, login };