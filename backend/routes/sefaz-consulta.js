const express = require('express');
const router = express.Router();
const { buscarCertificadoPorId } = require('./certificados');
const { consultarNFe } = require('../services/sefaz');

// Middleware simples de validação de token (pode importar do seu service)
const { validateToken } = require('../middlewares/auth'); // se já tiver
// Se não tiver, implemente aqui:

// POST /api/sefaz/status
router.post('/status', validateToken, async (req, res) => {
  try {
    // Aqui a lógica para checar status da SEFAZ
    // Exemplo simplificado:

    const ambiente = req.body.ambiente || 'homologacao';

    res.json({
      success: true,
      ambiente,
      message: 'Status SEFAZ OK (simulação)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro no /status:', error);
    res.status(500).json({ error: 'Erro ao consultar status SEFAZ' });
  }
});

// POST /api/sefaz/consulta (seu código já existente)
router.post('/consulta', validateToken, async (req, res) => {
  try {
    const {
      certificadoId,
      cnpjConsultado,
      tipoConsulta,
      ambiente,
      dataInicio,
      dataFim,
    } = req.body;

    if (!certificadoId || !cnpjConsultado || !tipoConsulta || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const certificado = await buscarCertificadoPorId(certificadoId, userId);
    if (!certificado) {
      return res.status(403).json({ error: 'Certificado não encontrado ou não autorizado' });
    }

    const resultado = await consultarNFe({
      certificado,
      cnpjConsultado,
      tipoConsulta,
      ambiente,
      dataInicio,
      dataFim,
    });

    res.json(resultado);
  } catch (err) {
    console.error('[Erro /api/sefaz/consulta]:', err);
    res.status(500).json({ error: 'Erro interno ao consultar a SEFAZ' });
  }
});

module.exports = router;
