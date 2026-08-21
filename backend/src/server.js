const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/db');

// ================================
// IMPORTAÇÃO DAS ROTAS
// ================================

const walletRoutes = require('./routes/walletRoutes');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/paymentRoutes');
const parentRoutes = require('./routes/parentRoutes');

const app = express();

app.set('trust proxy', 1);

// ================================
// 1. CONFIGURAÇÃO DO CORS
// ================================

// URLs permitidas
const defaultOrigins = [
  'https://cantina-adventista.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

// Caso exista FRONTEND_URL no Render,
// adiciona automaticamente ao CORS
const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL
      .split(',')
      .map((url) => url.trim().replace(/\/$/, ''))
      .filter(Boolean)
  : [];

// Remove URLs duplicadas
const allowedOrigins = [
  ...new Set([...defaultOrigins, ...envOrigins])
];

console.log('🌐 Origens permitidas pelo CORS:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    console.log('🌐 Origem recebida:', origin);

    // Permite requisições sem Origin
    // Ex.: Postman, servidor interno, health checks
    if (!origin) {
      return callback(null, true);
    }

    // Remove barra final caso exista
    const normalizedOrigin = origin.replace(/\/$/, '');

    // Verifica se a origem está autorizada
    if (allowedOrigins.includes(normalizedOrigin)) {
      console.log('✅ CORS permitido:', normalizedOrigin);
      return callback(null, true);
    }

    console.log('❌ CORS bloqueado:', normalizedOrigin);

    return callback(
      new Error(`Bloqueado pelo CORS: ${normalizedOrigin}`)
    );
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],

  optionsSuccessStatus: 204
};

// CORS deve vir antes das rotas
app.use(cors(corsOptions));

// Responde às requisições OPTIONS (preflight)
app.options('*', cors(corsOptions));


// ================================
// 2. HELMET
// ================================

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);


// ================================
// 3. RATE LIMITING GLOBAL
// ================================

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,

  // OPTIONS não deve ser limitado
  skip: (req) => req.method === 'OPTIONS',

  message: {
    error: 'Muitas requisições enviadas. Tente novamente mais tarde.'
  }
});

app.use(globalLimiter);


// ================================
// 4. PARSER DO BODY
// ================================

app.use(
  express.json({
    verify: (req, res, buf) => {
      try {
        req.rawBody = buf.toString();
      } catch (error) {
        req.rawBody = undefined;
      }
    }
  })
);


// ================================
// UPLOADS ESTÁTICOS
// ================================

app.use('/uploads', express.static('uploads'));


// ================================
// 5. LOGGER DE REQUISIÇÕES
// ================================

app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ` +
    `${req.method} ${req.originalUrl} - ` +
    `Origin: ${req.headers.origin || 'Sem Origin'} - ` +
    `Auth: ${req.headers.authorization ? 'Sim' : 'Não'}`
  );

  next();
});


// ================================
// 6. RATE LIMIT PARA LOGIN
// ================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,

  skip: (req) => req.method === 'OPTIONS',

  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  }
});

app.use('/api/auth/login', authLimiter);


// ================================
// ROTA DE TESTE
// ================================

app.get('/api/ping', (req, res) => {
  res.json({
    message: 'Backend conectado com sucesso!'
  });
});


// ================================
// 7. ROTAS DA API
// ================================

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/parent', parentRoutes);


// ================================
// HEALTH CHECK
// ================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date()
  });
});


// ================================
// EXPIRAÇÃO AUTOMÁTICA DE PEDIDOS
// ================================

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
      console.log(
        `[ESTOQUE] ${result.rowCount} pedido(s) expirado(s) atualizados.`
      );
    }

  } catch (error) {
    console.error(
      'Erro na rotina de expiração automática:',
      error.message
    );
  }

}, 2 * 60 * 1000);


// ================================
// LOGS E WEBHOOKS
// ================================

(async () => {
  try {

    // Tabela de logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Remove logs com mais de 6 meses
    const purgeQuery = `
      DELETE FROM logs
      WHERE created_at < NOW() - INTERVAL '6 months'
    `;

    await db.query(purgeQuery);

    // Limpeza diária
    setInterval(async () => {
      try {
        const result = await db.query(purgeQuery);

        if (result.rowCount > 0) {
          console.log(
            `[LOGS] ${result.rowCount} log(s) removido(s) por retenção de 6 meses.`
          );
        }

      } catch (err) {
        console.error(
          'Erro ao limpar logs antigos:',
          err.message || err
        );
      }

    }, 24 * 60 * 60 * 1000);

    console.log(
      '[LOGS] Tabela logs verificada e rotina de retenção agendada.'
    );


    // Tabela de eventos de webhook
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

    const purgeWebhook = `
      DELETE FROM webhook_events
      WHERE created_at < NOW() - INTERVAL '6 months'
    `;

    await db.query(purgeWebhook);

    // Limpeza diária dos webhooks
    setInterval(async () => {
      try {
        const result = await db.query(purgeWebhook);

        if (result.rowCount > 0) {
          console.log(
            `[WEBHOOKS] ${result.rowCount} webhook_events removidos por retenção.`
          );
        }

      } catch (err) {
        console.error(
          'Erro ao limpar webhook_events antigos:',
          err.message || err
        );
      }

    }, 24 * 60 * 60 * 1000);

    console.log(
      '[WEBHOOKS] Tabela webhook_events verificada e rotina de retenção agendada.'
    );

  } catch (err) {
    console.error(
      'Erro ao preparar tabelas de logs/webhooks:',
      err.message || err
    );
  }

})();


// ================================
// 8. ROTA NÃO ENCONTRADA
// ================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada.'
  });
});


// ================================
// 9. TRATAMENTO GLOBAL DE ERROS
// ================================

app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err.message || err);

  if (
    err.message &&
    err.message.includes('Bloqueado pelo CORS')
  ) {
    return res.status(403).json({
      error: 'Origem não permitida pelo CORS.'
    });
  }

  return res.status(500).json({
    error: 'Erro interno do servidor.'
  });
});


// ================================
// INICIAR SERVIDOR
// ================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Cantina+ rodando na porta ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});