// routes/sefazStatus.js
const express = require('express');
const router  = express.Router();

const { buscarCertificadoPrincipal } = require('../services/certificados');
const { consultarStatusSefaz }       = require('../services/sefaz');

// ----- rota simples de “ping” ------------------------------------------------
router.get('/', (req, res) => {
  res.json({
    status    : 'OK',
    servidor  : 'Proxy SEFAZ SP',
    timestamp : new Date().toISOString(),
    ambiente  : process.env.NODE_ENV || 'development',
  });
});

// ----- rota que consulta o web‑service de “Status do Serviço” ----------------
router.post('/', async (req, res) => {
  try {
    const ambiente = req.body.ambiente || 'producao';

    // pega o certificado “principal” salvo em banco
    const cert = await buscarCertificadoPrincipal();
    if (!cert || !cert.certificado_base64 || !cert.senha_certificado) {
      return res.status(404).json({
        success: false,
        error  : 'Nenhum certificado válido cadastrado.',
      });
    }

    const certificadoBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado  = cert.senha_certificado;

    // *** chamada usa objeto com buffer ***
    const xmlResposta = await consultarStatusSefaz({
      certificadoBuffer,
      senhaCertificado,
      ambiente,
    });

    res.json({
      success          : true,
      ambiente_recebido: ambiente,
      raw              : xmlResposta,
    });
  } catch (error) {
    console.error('Erro /api/status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
