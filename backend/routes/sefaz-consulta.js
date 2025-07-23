// ──────────────────────────────────────────────────────────────
// routes/sefaz-consulta.js
// ──────────────────────────────────────────────────────────────
const express = require('express');
const { SignedXml } = require('xml-crypto');
const { buscarCertificado } = require('../services/certificados');
const {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
} = require('../services/sefaz');
const { pfxToPem } = require('../services/pfx-utils');   // helper já criado

const router = express.Router();

/* ------------------------------------------------------------------
 * Assina <distDFeInt> com a chave PEM extraída do PFX
 *  – usa API nova do xml‑crypto (objeto de opções)
 * ----------------------------------------------------------------*/
/* ------------------------------------------------------------------
 * Troque apenas este bloco em routes/sefaz-consulta.js
 * ----------------------------------------------------------------*/
function assinarXML(xml, keyPem, certPem) {
  const sig = new SignedXml();

  sig.signatureAlgorithm =
    'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

  /* routes/sefaz-consulta.js  – dentro de assinarXML */

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

/* ------------------------------------------------------------------
 * POST  /api/sefaz/consulta
 * Body: { certificadoId, cnpjConsultado, ambiente }
 * ----------------------------------------------------------------*/
router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, ambiente } = req.body;

    if (!certificadoId || !cnpjConsultado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    /* 1. certificado escolhido */
    const cert = await buscarCertificado(certificadoId);
    if (!cert) return res.status(404).json({ error: 'Certificado não encontrado' });

    /* 2. extrai PEMs */
    const { keyPem, certPem } = pfxToPem(
      Buffer.from(cert.certificado_base64, 'base64'),
      cert.senha_certificado
    );

    /* 3. monta XML distDFeInt */
    const xmlDist = createDistDFeIntXML({
      tpAmb: ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ: cnpjConsultado,
      // agora passamos o valor em "ultNSU", que é o que a função espera
      ultNSU: '000000000000000'
    });

    /* 4. assina */
    const xmlAssinado = assinarXML(xmlDist, keyPem, certPem);

    /* 5. chama SEFAZ */
    const resposta = await consultarDistribuicaoDFe({
      certificadoBuffer: Buffer.from(cert.certificado_base64, 'base64'),
      senhaCertificado: cert.senha_certificado,
      tpAmb: ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ: cnpjConsultado,
      distNSU: '000000000000000',
      ambiente,
    });


    res.json({ success: true, raw: resposta });
  } catch (e) {
    console.error('Erro ao consultar SEFAZ:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
