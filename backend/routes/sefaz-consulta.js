const express = require('express');
const router = express.Router();

const { buscarCertificado } = require('../services/certificados');
const { consultarNFe } = require('../services/sefaz');
const { validateToken } = require('../services/auth');

router.use(validateToken); // protege todas as rotas abaixo

// POST /api/sefaz/status
router.post('/status', async (req, res) => {
  try {
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

// POST /api/sefaz/consulta
router.post('/consulta', async (req, res) => {
  try {
    console.log('Recebido corpo:', req.body);
    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente, dataInicio, dataFim } = req.body;

    if (!certificadoId || !cnpjConsultado || !tipoConsulta || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    console.log('User ID:', user.id);

    const certificado = await buscarCertificado(certificadoId, user);
    console.log('Certificado:', certificado);

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

    console.log('Resultado da consulta:', resultado);
    res.json(resultado);
  } catch (err) {
    console.error('[Erro /api/sefaz/consulta]:', err);
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno ao consultar a SEFAZ' });
  }
});

module.exports = router;
