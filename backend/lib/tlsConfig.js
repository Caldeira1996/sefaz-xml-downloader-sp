// lib/tlsConfig.js
const fs    = require('fs');
const path  = require('path');
const https = require('https');

// sai de lib/ e sobe um nível para backend/certs e backend/certificates
const CERTS_DIR = path.resolve(__dirname, '../certs');
const PFX_DIR   = path.resolve(__dirname, '../certificates');

function createMtlsAgent(pfxFilename, passphrase) {
  const pfxPath = path.join(PFX_DIR, pfxFilename);
  const caPath  = path.join(CERTS_DIR, 'chain.pem');

  console.log('🔥 [tlsConfig] PFX_DIR =',  PFX_DIR);
  console.log('🔥 [tlsConfig] pfxPath =',  pfxPath,  'exists?', fs.existsSync(pfxPath));
  console.log('🔥 [tlsConfig] caPath =',   caPath,   'exists?', fs.existsSync(caPath));

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

function getHttpsOptions(passphrase) {
  return {
    cert:       fs.readFileSync(path.join(CERTS_DIR, 'client-cert.pem')),
    key:        fs.readFileSync(path.join(CERTS_DIR, 'client-key.pem')),
    ca:         fs.readFileSync(path.join(CERTS_DIR, 'chain.pem')),
    passphrase,
  };
}

module.exports = { createMtlsAgent, getHttpsOptions };
