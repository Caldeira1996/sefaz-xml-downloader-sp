const express = require('express');
const router = express.Router();
const { validateToken } = require('./auth'); // ou '../services/auth' dependendo da posição

router.post('/upload', validateToken, async (req, res) => {
  try {
    // TODO: implementação upload
    res.json({
      success: true,
      message: 'Endpoint de upload preparado. Upload será implementado.'
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
