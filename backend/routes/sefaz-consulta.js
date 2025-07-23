// routes/sefaz-consulta.js
const express = require('express');
const { buscarCertificado } = require('../services/certificados');
const { createDistDFeIntXML, consultarDistribuicaoDFe } = require('../services/sefaz');
const { parseResponse } = require('../controller/doczip');

const router = express.Router();

/**
 * POST /consulta
 * Body: { certificadoId, cnpjConsultado, ambiente }
 */
router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, ambiente } = req.body;
    if (!certificadoId || !cnpjConsultado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    // 1) Recupera o PFX (base64 + senha) do DB
    const cert = await buscarCertificado(certificadoId);
    if (!cert) {
      return res.status(404).json({ error: 'Certificado não encontrado' });
    }

    // 2) Converte para Buffer e extrai a senha
    const pfxBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado = cert.senha_certificado;

    // 3) Gera o XML puro de <distDFeInt>
    const xmlDist = createDistDFeIntXML({
      tpAmb: ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ: cnpjConsultado,
      ultNSU: '000000000000000',
    });

    // 4) Chama o serviço de Distribuição de DF‑e (SOAP 1.1)
    const respostaXml = await consultarDistribuicaoDFe({
      certificadoBuffer: pfxBuffer,
      senhaCertificado,
      xmlDist,
      ambiente,
    });

    // 5) Parseia a resposta e extrai os documentos
    const resultado = await parseResponse(respostaXml);

    // 6) Retorna JSON com metadados e lista de XMLs
    return res.json({ success: true, ...resultado });
  } catch (e) {
    console.error('Erro ao consultar SEFAZ:', e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
