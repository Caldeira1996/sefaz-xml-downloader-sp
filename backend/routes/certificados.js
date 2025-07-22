const express = require('express');
const { buscarCertificado, listarCertificadosAtivos } = require('../services/certificados');

const router = express.Router();

// Listar certificados ativos - rota pública
router.get('/', async (req, res) => {
  try {
    const certificados = await listarCertificadosAtivos();
    res.json({ sucesso: true, certificados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// Buscar certificado por ID - sem autenticação
router.get('/:id', async (req, res) => {
  try {
    const certificadoId = req.params.id;
    const certificado = await buscarCertificado(certificadoId); // só passa o id agora
    res.json({ sucesso: true, certificado });
  } catch (err) {
    console.error(err);
    res.status(404).json({ sucesso: false, erro: err.message });
  }
});

module.exports = router;
