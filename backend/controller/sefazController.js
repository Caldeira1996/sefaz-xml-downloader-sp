// controllers/sefazController.js
const { buscarCertificado } = require('../services/certificados');
const { consultarNFe } = require('../services/sefaz');

exports.consulta = async (req, res) => {
  try {
    // ... todo seu código atual da rota POST /consulta aqui ...
  } catch (err) {
    console.error('[Erro /api/sefaz/consulta]:', err);
    res.status(500).json({ error: 'Erro interno ao consultar a SEFAZ' });
  }
};
