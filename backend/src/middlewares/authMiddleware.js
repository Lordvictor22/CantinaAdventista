const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'chave_secreta_padrao');
    req.user = verified;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'canteen')) {
    next();
  } else {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
};

// Middleware flexível para verificar papéis específicos
const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil.' });
    }
    next();
  };
};

module.exports = { verifyToken, verifyAdmin, verifyRole };