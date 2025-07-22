const express = require('express');
const { salvarCertificado, buscarCertificado, listarCertificadosAtivos } = require('../services/certificados');

const router = express.Router();

router.post('/certificados', (req, res) => {
  res.json({ status: 'Rota funcionando!', certificados: [] });
});

router.post('/', async (req, res) => {
  try {
    // Extrair dados do req.body
    const { nome, cnpj, certificado_base64, senha_certificado, ambiente } = req.body;

    // Aqui você salva o certificado no banco ou disco conforme sua lógica
    const certificadoSalvo = await salvarCertificado({ nome, cnpj, certificado_base64, senha_certificado, ambiente });

    res.status(201).json({ sucesso: true, certificado: certificadoSalvo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
  console.log('ROTAS DE CERTIFICADOS CARREGADAS');

});

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
