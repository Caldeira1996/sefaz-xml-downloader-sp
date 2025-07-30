const fs    = require('fs');
const path  = require('path');
const https = require('https');

// Caminhos para os diretórios de certificados
const CERTS_DIR = path.resolve(__dirname, '../certs');
const PFX_DIR   = path.resolve(__dirname, '../certificates');

/**
 * Cria um https.Agent para mTLS usando seu .pfx + chain.pem
 * @param {string} pfxFilename – nome do arquivo .pfx dentro de certificates/
 * @param {string} passphrase – senha do PFX
 */
function createMtlsAgent(pfxFilename, passphrase) {
  const pfxPath = path.join(PFX_DIR, pfxFilename);
  const caPath  = path.join(CERTS_DIR, 'chain.pem');

  console.log('🔥 [tlsConfig] PFX_PATH =', pfxPath, 'exists?', fs.existsSync(pfxPath));
  console.log('🔥 [tlsConfig] CA_PATH  =', caPath,  'exists?', fs.existsSync(caPath));

  if (!fs.existsSync(pfxPath)) {
    throw new Error('PFX não encontrado em ' + pfxPath);
  }
  if (!fs.existsSync(caPath)) {
    throw new Error('CA bundle não encontrado em ' + caPath);
  }

  return new https.Agent({
    pfx:                fs.readFileSync(pfxPath),
    passphrase:         passphrase,
    ca:                 fs.readFileSync(caPath),
    rejectUnauthorized: true,
  });
}

/**
 * Opções HTTPS para expor o Express em HTTPS
 * @param {string} passphrase – senha do key/cert, se houver
 */
function getHttpsOptions(passphrase) {
  return {
    cert:       fs.readFileSync(path.join(CERTS_DIR, 'client-cert.pem')),
    key:        fs.readFileSync(path.join(CERTS_DIR, 'client-key.pem')),
    ca:         fs.readFileSync(path.join(CERTS_DIR, 'chain.pem')),
    passphrase: passphrase,
  };
}

module.exports = { createMtlsAgent, getHttpsOptions };
