const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { convertPfxToPem } = require('../convert-pxf-to-pem');
const { supabase } = require('../supabase'); // seu client supabase configurado
const { validarCertificado } = require('../services/validate-cert');

const router = express.Router();
const upload = multer(); // usa memória para arquivos

router.post('/upload-cert', upload.single('file'), async (req, res) => {
  try {
    const { nome, senha, cnpj } = req.body;
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer || !nome || !senha || !cnpj) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // 1) Insere metadados no Supabase e obtém o ID
    const { data, error } = await supabase
      .from('certificados')
      .insert({ nome, cnpj, senha_certificado: senha })
      .select('id')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const id = data.id;

    // 2) Salva o arquivo .pfx com o nome do ID
    const certPath = path.join(__dirname, '../certificates', `${id}.pfx`);
    fs.writeFileSync(certPath, fileBuffer);
    console.log(`✅ Certificado salvo em ${certPath}`);

    // 3) Chama a função de validação
    const validacao = await validarCertificado({ certificadoPath: certPath, senhaCertificado: senha });
    if (!validacao.valido) {
      // Remove arquivo salvo se inválido
      fs.unlinkSync(certPath);
      return res.status(400).json({ error: `Certificado inválido: ${validacao.erro}` });
    }

    // 4) Converte e salva os arquivos .pem
    const certsOutputDir = path.join(__dirname, '../certs');
    if (!fs.existsSync(certsOutputDir)) {
      fs.mkdirSync(certsOutputDir);
    }
    await convertPfxToPem(fileBuffer, senha, certsOutputDir);
    console.log(`📁 Arquivos .pem salvos em ${certsOutputDir}`);

    // 5) Retorna sucesso e o ID para o frontend
    res.json({ success: true, id });

  } catch (error) {
    console.error('Erro ao salvar certificado:', error);
    res.status(500).json({ error: 'Erro ao salvar certificado' });
  }
});

module.exports = router;
