// backend/lib/tlsConfig.js
const fs   = require('fs');
const path = require('path');
const https = require('https');

const CA_DIR  = path.resolve(__dirname, '../certs');
const PFX_DIR = path.resolve(__dirname, '../certificates');

function loadPfx(certInput) {
  if (Buffer.isBuffer(certInput)) {
    return certInput;                 // já é Buffer
  }
  // senão, consideramos string → ler do disco
  const pfxPath = path.join(PFX_DIR, certInput);
  return fs.readFileSync(pfxPath);
}

function createMtlsAgent(certInput, passphrase) {
  const ca  = fs.readFileSync(path.join(CA_DIR, 'chain.pem'));
  const pfx = loadPfx(certInput);

  return new https.Agent({
    pfx,
    passphrase,
    ca,
    rejectUnauthorized: true,
  });
}

module.exports = { createMtlsAgent };
