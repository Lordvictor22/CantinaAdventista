const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/db');

// Importação das Rotas
const walletRoutes = require('./routes/walletRoutes');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/paymentRoutes');
const parentRoutes = require('./routes/parentRoutes');

const app = express();

// 1. Proteção de Headers HTTP com Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Configuração do CORS
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : [
      'http://localhost:5173', 
      'http://127.0.0.1:5173', 
      'http://localhost:3000', 
      'http://127.0.0.1:3000'
    ];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
};

app.use(cors(corsOptions));

// 3. Rate Limiting Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições enviadas. Tente novamente mais tarde.' }
});
app.use(globalLimiter);

// 4. Parser do Body (captura rawBody para verificação de assinatura em webhooks)
app.use(express.json({ verify: (req, res, buf) => { try { req.rawBody = buf.toString(); } catch (e) { req.rawBody = undefined; } } }));

// Exposição da pasta estática de uploads
app.use('/uploads', express.static('uploads'));

// 5. Logger de Requisições
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Auth:${req.headers.authorization ? 'Sim' : 'Não'}`);
    next();
  });
}

// 6. Rate Limiting para Autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});
app.use('/api/auth/login', authLimiter);

// Rota de Teste de Conexão Rápida
app.get('/api/ping', (req, res) => {
  res.json({ message: 'Backend conectado com sucesso!' });
});


// 7. Registro de Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/parent', parentRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Robô de Expiração Automática de Pedidos
setInterval(async () => {
  try {
    const queryText = `
      UPDATE orders
      SET status = 'expirado'
      WHERE status = 'pendente' 
        AND expires_at IS NOT NULL 
        AND expires_at < NOW();
    `;
    
    const result = await db.query(queryText);
    if (result.rowCount > 0) {
      console.log(`[ESTOQUE] ${result.rowCount} pedido(s) expirado(s) atualizados.`);
    }
  } catch (error) {
    console.error('Erro na rotina de expiração automática:', error.message);
  }
}, 2 * 60 * 1000);

// Logs e retenção: cria tabela de logs (se não existir) e rotina de limpeza (retenção 6 meses)
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Limpeza inicial: remover logs mais antigos que 6 meses (segurança e conformidade)
    const purgeQuery = `DELETE FROM logs WHERE created_at < NOW() - INTERVAL '6 months'`;
    await db.query(purgeQuery);

    // Agendar limpeza diária
    setInterval(async () => {
      try {
        const result = await db.query(purgeQuery);
        if (result.rowCount > 0) console.log(`[LOGS] ${result.rowCount} log(s) removido(s) por retenção de 6 meses.`);
      } catch (err) {
        console.error('Erro ao limpar logs antigos:', err.message || err);
      }
    }, 24 * 60 * 60 * 1000);

    console.log('[LOGS] Tabela logs verificada e rotina de retenção agendada (6 meses).');

    // Criar tabela de webhook_events (auditoria de webhooks e idempotência)
    await db.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id BIGSERIAL PRIMARY KEY,
        event_id TEXT,
        provider TEXT,
        payload JSONB,
        signature TEXT,
        processed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Limpeza inicial e agendada para webhook_events (remoção após 6 meses também)
    const purgeWebhook = `DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '6 months'`;
    await db.query(purgeWebhook);

    setInterval(async () => {
      try {
        const r = await db.query(purgeWebhook);
        if (r.rowCount > 0) console.log(`[WEBHOOKS] ${r.rowCount} webhook_events removidos por retenção.`);
      } catch (err) {
        console.error('Erro ao limpar webhook_events antigos:', err.message || err);
      }
    }, 24 * 60 * 60 * 1000);

    console.log('[WEBHOOKS] Tabela webhook_events verificada e rotina de retenção agendada (6 meses).');
  } catch (err) {
    console.error('Erro ao preparar tabela de logs:', err.message || err);
  }
})();

// 8. Tratamento de Rotas Inexistentes (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// 9. Middleware Global de Erros (500)
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  if (err.message === 'Bloqueado pelo CORS') {
    return res.status(403).json({ error: 'Origem não permitida pelo CORS.' });
  }
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Força a escuta em '0.0.0.0' para aceitar conexões IPv4 locais
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Cantina+ rodando em http://127.0.0.1:${PORT}`);
});