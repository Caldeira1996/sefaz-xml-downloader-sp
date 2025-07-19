
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { setupHTTPS } = require('./setup-https');
const app = require('./server');

const PORT = process.env.HTTPS_PORT || 3002;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

console.log(`🔧 Configurando HTTPS para o servidor SEFAZ...`);
console.log(`📋 Porta configurada: ${PORT}`);
console.log(`🌐 Host configurado: ${HOST}`);

// Configurar HTTPS
const sslConfig = setupHTTPS();

if (!sslConfig) {
  console.log('❌ Não foi possível carregar os certificados SSL.');
  console.log('🔧 Execute: chmod +x generate-ssl.sh && ./generate-ssl.sh');
  process.exit(1);
}

// criar e iniciar o servidor HTTPS usando o app
https.createServer(sslConfig, app).listen(PORT, HOST, () => {
  console.log(`🔐 Servidor HTTPS SEFAZ rodando em https://${HOST}:${PORT}`);
});

// Importar o app do servidor original (que já tem todas as rotas configuradas)
const app = require('./server');

// Função para tentar diferentes portas
const tryStartServer = (port) => {
  const httpsServer = https.createServer(sslConfig, app);
  
  httpsServer.listen(port, HOST, () => {
    console.log(`🔐 Servidor HTTPS SEFAZ rodando em https://${HOST}:${port}`);
    console.log(`🌐 Health check: https://${HOST}:${port}/health`);
    console.log(`✅ SSL/TLS configurado e funcionando!`);
  });

  httpsServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`⚠️  Porta ${port} já está em uso. Tentando porta ${port + 1}...`);
      httpsServer.close();
      tryStartServer(port + 1);
    } else {
      console.error('❌ Erro no servidor HTTPS:', error);
      process.exit(1);
    }
  });
};

// Iniciar servidor
tryStartServer(PORT);
