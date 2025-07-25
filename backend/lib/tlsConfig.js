// lib/tlsConfig.js
const fs   = require('fs');
const path = require('path');
const https = require('https');

// sai de lib/ e vai para backend/certs e backend/certificates
const CERTS_DIR = path.resolve(__dirname, '../certs');
const PFX_DIR   = path.resolve(__dirname, '../certificates');

/**
 * Cria um https.Agent para mTLS usando o seu PFX + chain.pem
 */
function createMtlsAgent(pfxFilename, passphrase) {
  const pfxPath = path.join(PFX_DIR, pfxFilename);
  const caPath  = path.join(CERTS_DIR, 'chain.pem');

  if (!fs.existsSync(pfxPath)) {
    throw new Error(`PFX não encontrado em ${pfxPath}`);
  }
  if (!fs.existsSync(caPath)) {
    throw new Error(`CA bundle não encontrado em ${caPath}`);
  }

  return new https.Agent({
    pfx:                fs.readFileSync(pfxPath),
    passphrase,
    ca:                 fs.readFileSync(caPath),
    rejectUnauthorized: true,
  });
}

/**
 * Se você expor o Express em HTTPS:
 */
function getHttpsOptions(passphrase) {
  return {
    cert:       fs.readFileSync(path.join(CERTS_DIR, 'client-cert.pem')),
    key:        fs.readFileSync(path.join(CERTS_DIR, 'client-key.pem')),
    ca:         fs.readFileSync(path.join(CERTS_DIR, 'chain.pem')),
    passphrase,
  };
}

module.exports = { createMtlsAgent, getHttpsOptions };
