
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { setupHTTPS } = require('./setup-https');

// Importar as rotas do servidor original
const app = express();
const PORT = process.env.HTTPS_PORT || 3001;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Importar todas as rotas do server.js original
// (Aqui vamos reutilizar a lógica do server.js)

// Configurar HTTPS
const sslConfig = setupHTTPS();

if (!sslConfig) {
  console.log('❌ Não foi possível carregar os certificados SSL.');
  console.log('🔧 Execute: chmod +x generate-ssl.sh && ./generate-ssl.sh');
  process.exit(1);
}

// Importar rotas do servidor original
const originalServer = require('./server');

// Copiar todas as rotas para o servidor HTTPS
app._router = originalServer._router;

// Criar servidor HTTPS
const httpsServer = https.createServer(sslConfig, app);

httpsServer.listen(PORT, HOST, () => {
  console.log(`🔐 Servidor HTTPS SEFAZ rodando em https://${HOST}:${PORT}`);
  console.log(`🌐 Health check: https://${HOST}:${PORT}/health`);
  console.log(`✅ SSL/TLS configurado e funcionando!`);
});

// Tratamento de erros
httpsServer.on('error', (error) => {
  console.error('❌ Erro no servidor HTTPS:', error);
  if (error.code === 'EADDRINUSE') {
    console.log(`⚠️  Porta ${PORT} já está em uso. Tente uma porta diferente.`);
  }
});
