// server-https.js  (é quem realmente chama listen, *só* HTTPS)
require('dotenv').config();
const https         = require('https');
const path          = require('path');
const app           = require('./server');
const { setupHTTPS } = require('./setup-https');

const PORT = parseInt(process.env.HTTPS_PORT || '3002', 10);
const HOST = process.env.SERVER_HOST       || '0.0.0.0';

console.log('🔧 Configurando HTTPS para o servidor SEFAZ…');
console.log(`📋 Porta configurada: ${PORT}`);
console.log(`🌐 Host configurado: ${HOST}`);

const sslConfig = setupHTTPS();
if (!sslConfig) {
  console.error('❌ Não foi possível carregar os certificados SSL.');
  process.exit(1);
}

// 1) Cria o servidor
const httpsServer = https.createServer(sslConfig, app);

// 2) Listener de erro **antes** de chamar listen
httpsServer.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Porta ${PORT} em uso, tentando ${PORT + 1}…`);
    httpsServer.listen(PORT + 1, HOST);
  } else {
    console.error('❌ Erro no servidor HTTPS:', err);
    process.exit(1);
  }
});

// 3) Finalmente sobe o servidor na porta definida
httpsServer.listen(PORT, HOST, () => {
  console.log(`🔐 HTTPS rodando em https://${HOST}:${PORT}`);
  console.log(`🌐 Health check: https://${HOST}:${PORT}/health`);
});
