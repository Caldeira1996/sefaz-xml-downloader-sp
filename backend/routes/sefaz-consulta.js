// ──────────────────────────────────────────────────────────────
// routes/sefaz-consulta.js
// ──────────────────────────────────────────────────────────────
const express = require('express');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');      // npm i @xmldom/xmldom

const router = express.Router();

const {
  buscarCertificado
} = require('../services/certificados');

const {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
} = require('../services/sefaz');

/** ------------------------------------------------------------------------
 * Assina o XML <distDFeInt> com o certificado A1
 * Simplificação: assinatura padrão enveloped, algoritmo RSA‑SHA1 (aceito pela SEFAZ).
 * ---------------------------------------------------------------------- */
function assinarXML(xml, pfxBuffer, senha) {
  const sig = new SignedXml();
  sig.addReference(
    "//*[local-name(.)='distDFeInt']",
    ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    "http://www.w3.org/2000/09/xmldsig#sha1"
  );
  sig.signingKey = {
    key: pfxBuffer,
    passphrase: senha
  };
  sig.computeSignature(xml);
  return sig.getSignedXml();
}

/** ------------------------------------------------------------------------
 * POST /api/sefaz/consulta
 * Body: { certificadoId, cnpjConsultado, ambiente, tipoConsulta, dataInicio?, dataFim? }
 * ---------------------------------------------------------------------- */
router.post('/consulta', async (req, res) => {
  try {
    const {
      certificadoId,
      cnpjConsultado,
      ambiente,
      tipoConsulta,
      dataInicio,
      dataFim
    } = req.body;

    if (!certificadoId || !cnpjConsultado || !ambiente || !tipoConsulta) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    // 1. Certificado escolhido
    const cert = await buscarCertificado(certificadoId);
    if (!cert) return res.status(404).json({ error: 'Certificado não encontrado' });

    const certificadoBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado  = cert.senha_certificado;

    // 2. Monta XML <distDFeInt>
    const xmlDist = createDistDFeIntXML({
      tpAmb     : ambiente === 'producao' ? '1' : '2',
      cUFAutor  : '35',                       // SP; ajuste se precisar
      CNPJ      : cnpjConsultado,
      distNSU   : '<consNSU><ultNSU>000000000000000</ultNSU></consNSU>'
    });

    // 3. Assina o XML
    const xmlAssinado = assinarXML(xmlDist, certificadoBuffer, senhaCertificado);

    // 4. Chama SEFAZ
    const resultado = await consultarDistribuicaoDFe({
      certificadoBuffer,
      senhaCertificado,
      xmlAssinado,
      ambiente,
    });

    res.json({ success: true, raw: resultado });
  } catch (err) {
    console.error('Erro ao consultar SEFAZ:', err);
    res.status(500).json({ error: 'Erro interno ao consultar SEFAZ' });
  }
});

module.exports = router;
