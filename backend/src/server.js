const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Conexão com o banco de dados para a rotina de limpeza
const db = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const uploadRoutes = require('./routes/upload'); // Rota de upload de imagens

const app = express();

// Configuração do CORS
app.use(cors());

// Parser de JSON no body da requisição
app.use(express.json());

// Registro de Rotas da API
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/upload', uploadRoutes);

// Rota de Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// =============================================================
// ROBÔ DE EXPIRAÇÃO AUTOMÁTICA DE PEDIDOS (A CADA 2 MINUTOS)
// =============================================================
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
      console.log(`[ESTOQUE] ${result.rowCount} pedido(s) não retirado(s) foram marcados como expirados.`);
    }
  } catch (error) {
    console.error('Erro na rotina de expiração automática:', error.message);
  }
}, 2 * 60 * 1000);

// Tratamento para rotas inexistentes (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Cantina+ rodando na porta ${PORT}`);
});