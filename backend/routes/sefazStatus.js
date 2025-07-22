const express = require('express');
const router = express.Router();

// ✅ Rota de status simples para testes
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    mensagem: 'Rota /status funcionando corretamente',
    timestamp: new Date().toISOString(),
  });
});

// ✅ Rota POST também (caso queira testar via POST como seu front faz)
router.post('/', (req, res) => {
  const ambiente = req.body.ambiente || 'desconhecido';
  res.json({
    status: 'OK',
    ambienteRecebido: ambiente,
    mensagem: 'Consulta de status SEFAZ realizada com sucesso (modo teste)',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
