const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // 1. Valida a presença e o formato 'Bearer <token>'
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido ou em formato inválido.' });
  }

  const token = authHeader.split(' ')[1];

  if (!process.env.JWT_SECRET) {
    console.error('❌ ERRO CRÍTICO: JWT_SECRET não está configurada no servidor!');
    return res.status(500).json({ error: 'Erro interno de configuração de segurança.' });
  }

  try {
    // 2. Trava o algoritmo para HS256 para evitar exploração de JWT
    const verified = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = verified;
    next();
  } catch (error) {
    // 3. Retorna 401 para que o frontend saiba que precisa redirecionar ao login
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

// Middleware genérico para verificação de papéis (Roles)
const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil.' });
    }
    next();
  };
};

// Reutiliza o verifyRole aceitando tanto 'cashier' quanto 'canteen' e 'admin'
const verifyAdmin = verifyRole('admin', 'cashier', 'canteen');

module.exports = { verifyToken, verifyAdmin, verifyRole };