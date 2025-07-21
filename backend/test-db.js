const pool = require('./db');

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Banco conectado com sucesso:', res.rows[0]);
  } catch (err) {
    console.error('❌ Erro ao conectar no banco:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
