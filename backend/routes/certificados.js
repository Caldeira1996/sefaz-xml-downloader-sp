const express = require('express');
const {
  salvarCertificado,
  buscarCertificado,
  listarCertificadosAtivos,
} = require('../services/certificados');
const db = require('../config/db'); // knex ou mysql2/promise

const { excluirCertificado } = require('../services/certificados');

const router = express.Router();

//route teste
router.get('/teste', (req, res) => {
  res.send('Certificados route está funcionando');
});


// POST /api/certificados - cadastrar novo certificado
router.post('/', async (req, res) => {
  try {
    const {
      nome,
      cnpj,
      certificado_base64,
      senha_certificado,
      ambiente,
      validade,
      tipo
    } = req.body;

    if (!nome || !cnpj || !certificado_base64 || !senha_certificado) {
      return res.status(400).json({ sucesso: false, erro: 'Dados obrigatórios ausentes.' });
    }

    const certificadoSalvo = await salvarCertificado({
      nome,
      cnpj,
      certificado_base64,
      senha_certificado,
      ambiente,
      validade,
      tipo
    });

    res.status(201).json({ sucesso: true, certificado: certificadoSalvo });
  } catch (err) {
    console.error('Erro ao salvar certificado:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// GET /api/certificados - listar todos certificados ativos
router.get('/', async (req, res) => {
  try {
    const certificados = await listarCertificadosAtivos();
    res.json({ sucesso: true, certificados });
  } catch (err) {
    console.error('Erro ao listar certificados:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// GET /api/certificados/:id - buscar certificado pelo ID
router.get('/:id', async (req, res) => {
  try {
    const certificadoId = req.params.id;
    const certificado = await buscarCertificado(certificadoId);
    res.json({ sucesso: true, certificado });
  } catch (err) {
    console.error('Erro ao buscar certificado:', err);
    res.status(404).json({ sucesso: false, erro: err.message });
  }
});

// DELETE /api/certificados/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ sucesso: false, erro: "ID inválido" });
    }
    await excluirCertificado(id);
    res.json({ sucesso: true, mensagem: `Certificado ${id} removido com sucesso!` });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message || 'Erro ao excluir certificado' });
  }
});

router.patch('/:id/principal', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await marcarComoPrincipal(id);
    res.json({ sucesso: true, mensagem: `Certificado ${id} agora é o principal.` });
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
});


module.exports = router;
