const express = require('express');
const router = express.Router();
const { buscarCertificadoPorId } = require('../services/certificates');
const { consultarNFe } = require('../services/sefaz');

// POST /api/sefaz/consulta
router.post('/consulta', async (req, res) => {
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

    const userId = req.user?.id; // certifique-se que seu middleware de auth popula req.user
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
