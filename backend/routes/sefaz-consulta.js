// ──────────────────────────────────────────────────────────────
// routes/sefaz-consulta.js
// ──────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();

const { buscarCertificado } = require('../services/certificados');
const { consultarNFe }      = require('../services/sefaz');

/**
 * POST /api/sefaz/consulta
 * Body:
 *  { certificadoId, cnpjConsultado, tipoConsulta, ambiente, dataInicio?, dataFim? }
 */
router.post('/consulta', async (req, res) => {
  try {
    const {
      certificadoId,
      cnpjConsultado,
      tipoConsulta,
      ambiente,
      dataInicio,
      dataFim
    } = req.body;

    if (!certificadoId || !cnpjConsultado || !tipoConsulta || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    // 1. Busca o certificado escolhido
    const cert = await buscarCertificado(certificadoId);
    if (!cert) {
      return res.status(404).json({ error: 'Certificado não encontrado' });
    }

    // 2. Converte Base64 → Buffer
    const certificadoBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado  = cert.senha_certificado;

    // 3. Chama serviço SEFAZ
    const resultado = await consultarNFe({
      certificadoBuffer,
      senhaCertificado,
      cnpjConsultado,
      tipoConsulta,
      ambiente,
      dataInicio,
      dataFim,
    });

    res.json(resultado);
  } catch (err) {
    console.error('Erro ao consultar SEFAZ:', err);
    res.status(500).json({ error: 'Erro interno ao consultar SEFAZ' });
  }
});

module.exports = router;
