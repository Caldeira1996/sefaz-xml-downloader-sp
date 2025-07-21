const forge = require('node-forge');
const fs = require('fs');

function convertPfxToPem(pfxBuffer, passphrase, outputDir) {
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

  const keyObj = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag][0];
  const certObj = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0];

  const privateKeyPem = forge.pki.privateKeyToPem(keyObj.key);
  const certificatePem = forge.pki.certificateToPem(certObj.cert);

  // Se tiver cadeia intermediária, inclui
  const caCerts = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]
    .slice(1) // pula o primeiro (é o próprio cert)
    .map(obj => forge.pki.certificateToPem(obj.cert))
    .join('\n');

  fs.writeFileSync(`${outputDir}/client-key.pem`, privateKeyPem);
  fs.writeFileSync(`${outputDir}/client-cert.pem`, certificatePem);
  fs.writeFileSync(`${outputDir}/ca-chain.pem`, caCerts || certificatePem); // fallback

  return true;
}

module.exports = { convertPfxToPem };
