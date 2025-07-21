const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pool = require('../db'); // Pool pg
const { convertPfxToPem } = require('../convert-pxf-to-pem');
const { validarCertificado } = require('../services/validate-cert');

const router = express.Router();
const upload = multer(); // memória para arquivos

router.post('/upload-cert', upload.single('file'), async (req, res) => {
  try {
    const { nome, senha, cnpj, user_id } = req.body; 
    // Importante: você precisa do user_id do usuário autenticado.
    // Se usar JWT, deve pegar do req.user (adaptar)

    const fileBuffer = req.file?.buffer;

    if (!fileBuffer || !nome || !senha || !cnpj || !user_id) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // 1) Inserir metadados no PostgreSQL
    const insertQuery = `
      INSERT INTO certificados (user_id, nome, cnpj, certificado_base64, senha_certificado)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const certificadoBase64 = fileBuffer.toString('base64');

    const { rows } = await pool.query(insertQuery, [
      user_id,
      nome,
      cnpj,
      certificadoBase64,
      senha,
    ]);

    const id = rows[0].id;

    // 2) Salvar arquivo .pfx localmente
    const certPath = path.join(__dirname, '../certificates', `${id}.pfx`);
    fs.writeFileSync(certPath, fileBuffer);
    console.log(`✅ Certificado salvo em ${certPath}`);

    // 3) Validar certificado
    const validacao = await validarCertificado({ certificadoPath: certPath, senhaCertificado: senha });
    if (!validacao.valido) {
      fs.unlinkSync(certPath);
      // opcional: delete registro no DB também
      await pool.query('DELETE FROM certificados WHERE id = $1', [id]);
      return res.status(400).json({ error: `Certificado inválido: ${validacao.erro}` });
    }

    // 4) Converter e salvar arquivos .pem
    const certsOutputDir = path.join(__dirname, '../certs');
    if (!fs.existsSync(certsOutputDir)) {
      fs.mkdirSync(certsOutputDir);
    }
    await convertPfxToPem(fileBuffer, senha, certsOutputDir);
    console.log(`📁 Arquivos .pem salvos em ${certsOutputDir}`);

    // 5) Responder sucesso
    res.json({ success: true, id });

  } catch (error) {
    console.error('Erro ao salvar certificado:', error);
    res.status(500).json({ error: 'Erro ao salvar certificado' });
  }
});

module.exports = router;
