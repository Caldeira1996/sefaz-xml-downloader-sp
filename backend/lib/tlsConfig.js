const fs   = require('fs');
const path = require('path');
const https = require('https');

const CA_DIR  = path.resolve(__dirname, '../certs');
const chainPath = path.join(CA_DIR, 'chain.pem');

/**
 * Carrega certificado PFX tanto de Buffer quanto de arquivo.
 */
function loadPfx(certInput) {
  if (Buffer.isBuffer(certInput)) return certInput;
  return fs.readFileSync(path.join(path.resolve(__dirname, '../certificates'), certInput));
}

function createMtlsAgent(certInput, passphrase) {
  // ⚠️ Lê sua cadeia customizada (G4 + Raiz v10)
  const customCa = fs.readFileSync(chainPath);

  // 🚀 Pega a store default que o Node já carrega (Sectigo, DigiCert, etc.)
  const systemCa = https.globalAgent.options.ca || [];

  // Junta tudo num array (garante que sempre seja array)
  const caBundle = Array.isArray(systemCa)
    ? [...systemCa, customCa]
    : [systemCa, customCa];

  return new https.Agent({
    pfx: loadPfx(certInput),
    passphrase,
    ca: caBundle,
    rejectUnauthorized: false,
  });
}

module.exports = { createMtlsAgent };
