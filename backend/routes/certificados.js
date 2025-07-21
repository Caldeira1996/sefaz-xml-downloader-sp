// routes/certificados.js
const express = require('express');
const { validateToken } = require('../services/auth');
const { buscarCertificado } = require('../services/certificados');

const router = express.Router();

router.get('/:id', validateToken, async (req, res) => {
  try {
    const certificadoId = req.params.id;
    const user = req.user; // setado pelo validateToken

    const certificado = await buscarCertificado(certificadoId, user);

    res.json({ sucesso: true, certificado });
  } catch (err) {
    console.error(err);
    res.status(404).json({ sucesso: false, erro: err.message });
  }
});

module.exports = router;
