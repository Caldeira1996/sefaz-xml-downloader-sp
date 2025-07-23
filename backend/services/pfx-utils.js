// services/pfx-utils.js
const forge = require('node-forge');

function pfxToPem(pfxBuffer, passphrase) {
  const p12 = forge.pkcs12.pkcs12FromAsn1(
    forge.asn1.fromDer(pfxBuffer.toString('binary')),
    false,
    passphrase
  );

  let keyPem = '';
  let certPem = '';

  p12.safeContents.forEach(safe => {
    safe.safeBags.forEach(bag => {
      if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        keyPem = forge.pki.privateKeyToPem(bag.key);
      }
      if (bag.type === forge.pki.oids.certBag) {
        certPem = forge.pki.certificateToPem(bag.cert);
      }
    });
  });

  if (!keyPem || !certPem) throw new Error('Falha ao extrair chave/cert.');
  return { keyPem, certPem };
}

module.exports = { pfxToPem };
