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
    // Ambiente pode ser 'producao' ou 'homologacao'
    const ambiente = req.body.ambiente || 'producao';

    // Busca o principal da empresa
    const certificado = await buscarCertificadoPrincipal();

    // Converte base64 do banco para Buffer e pega a senha
    const buffer = Buffer.from(certificado.certificado_base64, 'base64');
    const senha = certificado.senha_certificado;

    if (!buffer || !senha) {
      return res.status(404).json({ success: false, error: 'Nenhum certificado válido cadastrado.' });
    }

    // Consulta real na SEFAZ SP
    const resultado = await consultarStatusSefaz(buffer, senha, ambiente);

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
