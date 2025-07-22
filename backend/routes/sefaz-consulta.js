const express = require('express');
const router = express.Router();
const { buscarCertificado } = require('../services/certificados');
const { consultarNFe } = require('../services/sefaz');

router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente, dataInicio, dataFim } = req.body;

    if (!certificadoId || !cnpjConsultado || !tipoConsulta || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    // Busca o certificado sem usuário e sem autenticação
    const certificado = await buscarCertificado(certificadoId);

    if (!certificado) {
      return res.status(404).json({ error: 'Certificado não encontrado' });
    }

    const resultado = await consultarNFe({
      certificadoBuffer: certificado.certificadoBuffer,
      senhaCertificado: certificado.senhaCertificado,
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
