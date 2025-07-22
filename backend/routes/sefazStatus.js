// arquivo routes/sefazStatus.js
const express = require('express');
const router = express.Router();

router.post('/status', (req, res) => {
  return res.json({ success: true, message: 'Backend SEFAZ está online!' });
});

module.exports = router;
