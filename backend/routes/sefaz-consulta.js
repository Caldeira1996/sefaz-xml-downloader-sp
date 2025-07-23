const express = require('express');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');

const router = express.Router();

const { buscarCertificado } = require('../services/certificados');
const {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
} = require('../services/sefaz');

const { pfxToPem } = require('../services/pfx-utils');

/* assina XML usando chave PEM */
function assinarXML(xml, keyPem, certPem) {
  const sig = new SignedXml();
  sig.addReference(
    "//*[local-name(.)='distDFeInt']",
    ['http://www.w3.org/2000/09/xmldsig#enveloped-signature'],
    'http://www.w3.org/2000/09/xmldsig#sha1'
  );
  sig.signingKey = keyPem;
  sig.keyInfoProvider = {
    getKeyInfo: () => `<X509Data>${certPem}</X509Data>`
  };
  sig.computeSignature(xml);
  return sig.getSignedXml();
}

router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, ambiente } = req.body;
    if (!certificadoId || !cnpjConsultado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros faltando' });
    }

    /* certificado */
    const cert = await buscarCertificado(certificadoId);
    if (!cert) return res.status(404).json({ error: 'Certificado não encontrado' });

    /* extrai chave/cert PEM */
    const { keyPem, certPem } = pfxToPem(
      Buffer.from(cert.certificado_base64, 'base64'),
      cert.senha_certificado
    );

    /* XML distDFeInt */
    const xmlDist = createDistDFeIntXML({
      tpAmb: ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ: cnpjConsultado,
      distNSU: '<consNSU><ultNSU>000000000000000</ultNSU></consNSU>'
    });

    /* assina */
    const xmlAssinado = assinarXML(xmlDist, keyPem, certPem);

    /* chama SEFAZ */
    const resposta = await consultarDistribuicaoDFe({
      certificadoBuffer: Buffer.from(cert.certificado_base64, 'base64'),
      senhaCertificado : cert.senha_certificado,
      xmlAssinado,
      ambiente
    });

    res.json({ success: true, raw: resposta });
  } catch (e) {
    console.error('Erro ao consultar SEFAZ:', e);
    res.status(500).json({ error: 'Erro interno ao consultar SEFAZ' });
  }
});

module.exports = router;
