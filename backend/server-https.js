// server-https.js
require('dotenv').config();
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const app   = require('./server');

// 1) Localização absoluta dos certificados
const CERT_DIR  = path.resolve(__dirname, 'certs');
const CERT_PATH = path.join(CERT_DIR, 'client-cert.pem');
const KEY_PATH  = path.join(CERT_DIR, 'client-key.pem');
const CA_PATH   = path.join(CERT_DIR, 'chain.pem');

console.log('🔧 Configurando HTTPS para o servidor SEFAZ…');
console.log(`📂 Diretório de certificados: ${CERT_DIR}`);

// 2) Verifica existência dos arquivos
const missing = [];
if (!fs.existsSync(CERT_PATH)) missing.push(`cert: ${CERT_PATH}`);
if (!fs.existsSync(KEY_PATH))  missing.push(`key : ${KEY_PATH}`);
if (!fs.existsSync(CA_PATH))   missing.push(`ca  : ${CA_PATH}`);

if (missing.length) {
  console.error('❌ Alguns arquivos SSL não foram encontrados:\n', missing.join('\n'));
  process.exit(1);
}

// 3) Prepara configuração SSL
const sslConfig = {
  cert:        fs.readFileSync(CERT_PATH),
  key:         fs.readFileSync(KEY_PATH),
  ca:          fs.readFileSync(CA_PATH),
  passphrase:  process.env.CERT_PASSWORD,
  rejectUnauthorized: true,
};

// 4) Porta e host
const PORT = parseInt(process.env.HTTPS_PORT || '3002', 10);
const HOST = process.env.SERVER_HOST       || '0.0.0.0';

console.log(`📋 Porta configurada: ${PORT}`);
console.log(`🌐 Host configurado: ${HOST}`);

// 5) Cria o servidor HTTPS
const httpsServer = https.createServer(sslConfig, app);

// 6) Tratamento de erro antes do listen (ex: porta em uso)
httpsServer.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Porta ${PORT} em uso, tentando ${PORT + 1}…`);
    httpsServer.listen(PORT + 1, HOST);
  } else {
    console.error('❌ Erro no servidor HTTPS:', err);
    process.exit(1);
  }
});

// 7) Sobe o servidor
httpsServer.listen(PORT, HOST, () => {
  const actualPort = httpsServer.address().port;
  console.log(`🔐 HTTPS rodando em https://${HOST}:${actualPort}`);
  console.log(`🌐 Health check: https://${HOST}:${actualPort}/health`);
});
