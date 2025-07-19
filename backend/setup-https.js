const fs = require('fs');
const path = require('path');
const https = require('https');

const certDir = path.join(__dirname, 'certs');

const agent = new https.Agent({
  cert: fs.readFileSync(path.join(certDir, 'client-cert.pem')),
  key: fs.readFileSync(path.join(certDir, 'client-key.pem')),
  ca: fs.readFileSync(path.join(certDir, 'ca-cert.pem')), // raiz + intermediário concatenados
  rejectUnauthorized: false,
  //passphrase: '123456' // a senha do seu certificado
});

// Exporta para ser usado nas requisições à SEFAZ
module.exports = { agent };


// ⚠️ Se quiser usar setupHTTPS para montar um servidor local HTTPS:
const setupHTTPS = () => {
  const certDir = path.join(__dirname, 'certs');

  const certPath = path.join(certDir, 'client-cert.pem');
  const keyPath = path.join(certDir, 'client-key.pem');
  const caPath = path.join(certDir, 'ca-cert.pem'); // <- atualizado

  if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(caPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      ca: fs.readFileSync(caPath)
    };
  } else {
    console.log('❌ Alguns certificados SSL não foram encontrados em certs/');
    return null;
  }
};

module.exports.setupHTTPS = setupHTTPS;
