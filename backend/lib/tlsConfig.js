const fs   = require('fs');
const path = require('path');
const https = require('https');
const tls   = require('tls');

const CA_DIR     = path.resolve(__dirname, '../certs');
const chainPath  = path.join(CA_DIR, 'full-chain.pem');   // 6 CAs que geramos
const CERTS_DIR  = path.resolve(__dirname, '../certificates');

/** Carrega PFX tanto de Buffer quanto de caminho de arquivo */
function loadPfx(certInput) {
  if (Buffer.isBuffer(certInput)) return certInput;
  return fs.readFileSync(path.join(CERTS_DIR, certInput));
}

/** Cria https.Agent com mTLS + cadeia customizada SOMADA à store do Node */
function createMtlsAgent(certInput, passphrase) {
  const customCa = fs.readFileSync(chainPath);  // suas CAs extras
  const systemCa = tls.rootCertificates;        // CAs nativas do Node

  return new https.Agent({
    pfx: loadPfx(certInput),
    passphrase,
    ca: [...systemCa, customCa],                // <‑‑ soma, não substitui
    rejectUnauthorized: true                    // true em produção
  });
}

module.exports = { createMtlsAgent };
