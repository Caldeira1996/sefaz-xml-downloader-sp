const fs = require('fs');
const path = require('path');
const https = require('https');

const certDir = path.join(__dirname, 'certs');

const certPath = path.join(certDir, 'client-cert.pem');
const keyPath = path.join(certDir, 'client-key.pem');
const caPath = path.join(certDir, 'ca-chain.pem'); // cadeia intermediária + raiz

// Agente HTTPS para requisições à SEFAZ
const agent = new https.Agent({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath),
  ca: fs.readFileSync(caPath),
  rejectUnauthorized: true,
  passphrase: process.env.CERT_PASSWORD || undefined,
});

// Para servidor local HTTPS
const setupHTTPS = () => {
  if (
    fs.existsSync(certPath) &&
    fs.existsSync(keyPath) &&
    fs.existsSync(caPath)
  ) {
    const sslConfig = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      ca: fs.readFileSync(caPath),
    };
    if (process.env.CERT_PASSWORD) {
      sslConfig.passphrase = process.env.CERT_PASSWORD;
    }
    return sslConfig;
  } else {
    console.error('❌ Alguns certificados SSL não foram encontrados em certs/');
    return null;
  }
};

module.exports = {
  agent,
  setupHTTPS,
};
