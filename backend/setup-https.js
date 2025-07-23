// server-https.js
require('dotenv').config();
const https      = require('https');
const path       = require('path');
const app        = require('./server');      // o Express puro
const { setupHTTPS } = require('./setup-https');

const PORT = parseInt(process.env.HTTPS_PORT || '3002', 10);
const HOST = process.env.SERVER_HOST       || '0.0.0.0';

console.log('🔧 Configurando HTTPS...');
const sslConfig = setupHTTPS();
if (!sslConfig) {
  console.error('❌ Não foi possível carregar os certificados SSL.');
  process.exit(1);
}

const server = https.createServer(sslConfig, app);

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Porta ${PORT} em uso, tentando ${PORT + 1}...`);
    server.listen(PORT + 1, HOST);
  } else {
    console.error('❌ Erro no HTTPS server:', err);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🔐 HTTPS rodando em https://${HOST}:${PORT}`);
});
