const express = require('express');
const router = express.Router();
const { buscarCertificadoPrincipal } = require('../services/certificados');
const { consultarStatusSefaz } = require('../services/sefaz');

// GET /api/status — Healthcheck simples
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    servidor: 'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development',
  });
});

// POST /api/status — Consulta status REAL da SEFAZ SP usando o certificado principal do banco
router.post('/', async (req, res) => {
  try {
    const ambiente = req.body.ambiente || 'producao';
    const certificado = await buscarCertificadoPrincipal();

    if (!certificado || !certificado.certificado_base64 || !certificado.senha_certificado) {
      return res.status(404).json({ success: false, error: 'Nenhum certificado válido cadastrado.' });
    }

    // Buffer do certificado (se vier como base64 string do banco)
    const certificadoBuffer = Buffer.from(certificado.certificado_base64, 'base64');
    const senhaCertificado = certificado.senha_certificado;

    // Faz a consulta real na SEFAZ SP
    const resultado = await consultarStatusSefaz(
      certificadoBuffer,
      senhaCertificado,
      ambiente
    );

    res.json({
      success: resultado.sucesso,
      ambiente_recebido: ambiente,
      statusCode: resultado.statusCode,
      motivo: resultado.motivo,
      timestamp: new Date().toISOString(),
      raw: resultado.raw,
      error: resultado.error // <- coloque isso pra passar o erro se tiver!
    });
  } catch (error) {
    console.error('Erro /api/status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
