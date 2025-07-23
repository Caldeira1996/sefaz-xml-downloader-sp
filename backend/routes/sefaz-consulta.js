// routes/sefaz-consulta.js
const express = require('express');
const { SignedXml } = require('xml-crypto');
const { buscarCertificado } = require('../services/certificados');
const {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
} = require('../services/sefaz');
const { pfxToPem } = require('../services/pfx-utils');

const router = express.Router();

// Função que assina o XML de <distDFeInt>
function assinarXML(xml, keyPem, certPem) {
  const sig = new SignedXml();
  sig.signatureAlgorithm =
    'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

  sig.addReference(
    "//*[local-name(.)='distDFeInt']",
    ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
    'http://www.w3.org/2000/09/xmldsig#sha1'
  );

  sig.signingKey = keyPem;
  sig.keyInfoProvider = {
    getKeyInfo: () =>
      `<X509Data><X509Certificate>` +
      certPem
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\r?\n|\r/g, '') +
      `</X509Certificate></X509Data>`
  };

  sig.computeSignature(xml);
  return sig.getSignedXml();
}

router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, ambiente } = req.body;
    if (!certificadoId || !cnpjConsultado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    // 1) busca o certificado no banco
    const cert = await buscarCertificado(certificadoId);
    if (!cert) return res.status(404).json({ error: 'Certificado não encontrado' });

    // 2) converte PFX → PEM
    const { keyPem, certPem } = pfxToPem(
      Buffer.from(cert.certificado_base64, 'base64'),
      cert.senha_certificado
    );

    // 3) monta e assina o <distDFeInt>
    const xmlDist = createDistDFeIntXML({
      tpAmb: ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ: cnpjConsultado,
      ultNSU: '000000000000000',
    });
    const xmlAssinado = assinarXML(xmlDist, keyPem, certPem);

    // 4) chama a SEFAZ
    const resposta = await consultarDistribuicaoDFe({
      certificadoBuffer: Buffer.from(cert.certificado_base64, 'base64'),
      senhaCertificado: cert.senha_certificado,
      xmlAssinado,
      ambiente,
    });

    res.json({ success: true, raw: resposta });
  } catch (e) {
    console.error('Erro ao consultar SEFAZ:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
