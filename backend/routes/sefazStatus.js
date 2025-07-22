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

// POST /api/status — Consulta status REAL da SEFAZ SP usando o certificado
router.post('/', async (req, res) => {
  try {
    // ambiente pode ser 'producao' ou 'homologacao'
    const ambiente = req.body.ambiente || 'producao';

    // Pegue o principal da sua empresa (ajuste a função se necessário)
    const certificado = await buscarCertificadoPrincipal();

    if (!certificado || !certificado.certificadoBuffer || !certificado.senhaCertificado) {
      return res.status(404).json({ success: false, error: 'Nenhum certificado válido cadastrado.' });
    }

    // Faz a consulta real na SEFAZ SP
    const resultado = await consultarStatusSefaz(
      certificado.certificadoBuffer,
      certificado.senhaCertificado,
      ambiente
    );

    res.json({
      success: resultado.sucesso,
      ambiente_recebido: ambiente,
      statusCode: resultado.statusCode,
      motivo: resultado.motivo,
      timestamp: new Date().toISOString(),
      raw: resultado.raw,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
