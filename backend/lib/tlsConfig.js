// lib/tlsConfig.js
const fs   = require('fs');
const path = require('path');
const https = require('https');

const CERT_DIR = path.resolve(__dirname, 'certs');
const PFX_DIR  = path.resolve(__dirname, 'certificates');

const CA_PATH  = path.join(CERT_DIR, 'chain.pem');
const PFX_PATH = path.join(PFX_DIR,  '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
const PASSPHRASE = process.env.CERT_PASSWORD; // ou '123456' em dev

// Agente para as requisições mTLS ao SEFAZ
const mtlsAgent = new https.Agent({
  pfx:        fs.readFileSync(PFX_PATH),
  passphrase: PASSPHRASE,
  ca:         fs.readFileSync(CA_PATH),
  rejectUnauthorized: true,
});

// Config SSL/TLS para expor o seu Express em HTTPS
const httpsOptions = {
  cert: fs.readFileSync(path.join(CERT_DIR, 'client-cert.pem')),
  key:  fs.readFileSync(path.join(CERT_DIR, 'client-key.pem')),
  ca:   fs.readFileSync(CA_PATH),
  passphrase: PASSPHRASE,
};

module.exports = { mtlsAgent, httpsOptions };
