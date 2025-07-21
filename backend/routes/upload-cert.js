const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { convertPfxToPem } = require('../convert-pxf-to-pem');

const router = express.Router();
const upload = multer(); // memória

router.post('/upload-cert', upload.single('file'), async (req, res) => {
  try {
    const { nome, senha } = req.body;
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer || !nome || !senha) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const certPath = path.join(__dirname, '../certificates', `${nome}.pfx`);
    fs.writeFileSync(certPath, fileBuffer);
    console.log(`✅ Certificado salvo em ${certPath}`);

    // 🔐 Converte e salva os arquivos .pem
    const certsOutputDir = path.join(__dirname, '../certs');
    if (!fs.existsSync(certsOutputDir)) {
      fs.mkdirSync(certsOutputDir);
    }

    convertPfxToPem(fileBuffer, senha, certsOutputDir);
    console.log(`📁 Arquivos .pem salvos em ${certsOutputDir}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar certificado:', error);
    res.status(500).json({ error: 'Erro ao salvar certificado' });
  }
});

module.exports = router;
