// routes/sefaz-consulta.js
const express = require('express');
const { buscarCertificado } = require('../services/certificados');
const { createDistDFeIntXML, consultarDistribuicaoDFe } = require('../services/sefaz');
const { parseResponse } = require('../controller/doczip');

const router = express.Router();

router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, ambiente } = req.body;
    if (!certificadoId || !cnpjConsultado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }
    const cert = await buscarCertificado(certificadoId);
    if (!cert) {
      return res.status(404).json({ error: 'Certificado não encontrado' });
    }
    const pfxBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado = cert.senha_certificado;
    const xmlDist = createDistDFeIntXML({
      tpAmb: ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ: cnpjConsultado,
      ultNSU: '000000000000000',
    });
    const respostaXml = await consultarDistribuicaoDFe({
      certificadoBuffer: pfxBuffer,
      senhaCertificado,
      xmlDist,
      ambiente,
    });
    const resultado = await parseResponse(respostaXml);
    return res.json({ success: true, ...resultado });
  } catch (e) {
    console.error('Erro ao consultar SEFAZ:', e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
