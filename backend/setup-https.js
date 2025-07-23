// setup-https.js
const fs   = require('fs');
const path = require('path');
const https = require('https');

const certDir  = path.join(__dirname, 'certs');
const certPath = path.join(certDir, 'client-cert.pem');
const keyPath  = path.join(certDir, 'client-key.pem');
const caPath   = path.join(certDir, 'ca-chain.pem');

function setupHTTPS() {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(caPath)) {
    const sslConfig = {
      cert: fs.readFileSync(certPath),
      key:  fs.readFileSync(keyPath),
      ca:   fs.readFileSync(caPath),
    };
    if (process.env.CERT_PASSWORD) {
      sslConfig.passphrase = process.env.CERT_PASSWORD;
    }
    return sslConfig;
  } else {
    console.error('❌ Alguns certificados SSL não foram encontrados em certs/');
    return null;
  }
}

// Exporta também um agent para suas requisições https externas, se precisar
const agent = new https.Agent({
  cert: fs.readFileSync(certPath),
  key:  fs.readFileSync(keyPath),
  ca:   fs.readFileSync(caPath),
  rejectUnauthorized: true,
  passphrase: process.env.CERT_PASSWORD,
});

module.exports = { setupHTTPS, agent };
