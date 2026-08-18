const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString || !connectionString.startsWith('postgres')) {
  console.error('❌ ERRO CRÍTICO: DATABASE_URL ausente ou inválida nas variáveis de ambiente!');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('⚡ Conectado ao banco de dados Supabase com sucesso!');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool do PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(), // Adicionado para resolver o erro do orderController
  getClient: () => pool.connect(),
  pool,
};