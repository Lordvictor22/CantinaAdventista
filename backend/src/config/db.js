const { Pool } = require('pg');
const path = require('path');

// Carrega o arquivo .env localizado na raiz da pasta backend
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERRO CRÍTICO: A variável DATABASE_URL não foi encontrada no .env!');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
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
  getClient: () => pool.connect(),
  pool,
};