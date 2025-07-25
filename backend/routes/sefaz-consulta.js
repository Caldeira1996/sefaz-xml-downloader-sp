// routes/sefaz-consulta.js
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { buscarCertificado }            = require('../services/certificados');
const { createDistDFeIntXML, consultarDistribuicaoDFe } = require('../services/sefaz');
const { parseResponse }                = require('../controller/doczip');

const router = express.Router();

router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, ambiente } = req.body;
    if (!certificadoId || !cnpjConsultado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    // 1) Busca o PFX no banco
    const cert = await buscarCertificado(certificadoId);
    if (!cert) {
      return res.status(404).json({ error: 'Certificado não encontrado' });
    }
    const pfxBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado = cert.senha_certificado;

    // 2) Carrega o ca-bundle **inline** e loga seu tamanho
    const CA_PATH = path.resolve(__dirname, '../certs/ca-bundle.pem');
    const caBundleInline = fs.readFileSync(CA_PATH);
    console.log('> [ROTA] caBundleInline carregado de:', CA_PATH);
    console.log('> [ROTA] caBundleInline.length =', caBundleInline.length);
    console.log('> [ROTA] pfxBuffer.length       =', pfxBuffer.length);

    // 3) Gera o XML de consulta
    const xmlDist = createDistDFeIntXML({
      tpAmb: ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ: cnpjConsultado,
      ultNSU: '000000000000000',
    });

    // 4) Chama o serviço (adapte o service para aceitar opção de agent se quiser)
    const respostaXml = await consultarDistribuicaoDFe({
      certificadoBuffer: pfxBuffer,
      senhaCertificado,
      xmlDist,
      ambiente,
      // opcional: httpsAgentOverride: new https.Agent({ pfx: pfxBuffer, passphrase: senhaCertificado, ca: caBundleInline, rejectUnauthorized: true })
    });

    // 5) Processa e retorna
    const resultado = await parseResponse(respostaXml);
    return res.json({ success: true, ...resultado });
  }
  catch (e) {
    console.error('> [ROTA] Erro ao consultar SEFAZ:', e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
