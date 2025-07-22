const express = require('express');
const router = express.Router();

// GET /status
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    servidor: 'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development',
  });
});

// POST /status
router.post('/', (req, res) => {
  const ambiente = req.body.ambiente || 'não informado';
  res.json({
    status: 'OK',
    ambiente_recebido: ambiente,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
