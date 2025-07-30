// backend/lib/tlsConfig.js
const fs   = require('fs');
const path = require('path');
const https = require('https');

const CA_DIR  = path.resolve(__dirname, '../certs');
const PFX_DIR = path.resolve(__dirname, '../certificates');

/**
 * Retorna um https.Agent configurado para mTLS.
 * @param {string} certFilename  ex.: 'empresa.pfx'
 * @param {string} passphrase    senha do PFX
 */
function createMtlsAgent(certFilename, passphrase) {
  const pfxPath = path.join(PFX_DIR, certFilename);
  const caPath  = path.join(CA_DIR,  'chain.pem');

  const pfx = fs.readFileSync(pfxPath);
  const ca  = fs.readFileSync(caPath);

  return new https.Agent({
    pfx,
    passphrase,
    ca,
    rejectUnauthorized: true,
  });
}

module.exports = { createMtlsAgent };
