// arquivo routes/sefazStatus.js
const express = require('express');
const router = express.Router();

app.post('/api/sefaz/status', (req, res) => {
  res.json({ success: true, message: 'Sem autenticação por enquanto' });
});


module.exports = router;
