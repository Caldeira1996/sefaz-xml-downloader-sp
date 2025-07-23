// server-https.js
require('dotenv').config();
const https         = require('https');
const path          = require('path');
const app           = require('./server');       // importa o app sem listen
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

function tryStartServer(port) {
  const httpsServer = https.createServer(sslConfig, app);

  httpsServer.listen(port, HOST, () => {
    console.log(`🔐 HTTPS rodando em https://${HOST}:${port}`);
    console.log(`🌐 Health check: https://${HOST}:${port}/health`);
  });

  httpsServer.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`⚠️ Porta ${port} em uso, tentando ${port + 1}…`);
      httpsServer.close();
      tryStartServer(port + 1);
    } else {
      console.error('❌ Erro no servidor HTTPS:', error);
      process.exit(1);
    }
  });
}

tryStartServer(PORT);
