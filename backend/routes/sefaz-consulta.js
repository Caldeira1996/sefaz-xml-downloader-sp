// routes/sefaz-consulta.js
const express = require('express');
const fs      = require('fs');
const path    = require('path');

const { buscarCertificado }             = require('../services/certificados');
const { createDistDFeIntXML,
        consultarDistribuicaoDFe }      = require('../services/sefaz');
const { parseResponse }                 = require('../controller/doczip');

const router = express.Router();

router.post('/consulta', async (req, res) => {
  try {
    const { certificadoId, cnpjConsultado, ambiente } = req.body;
    if (!certificadoId || !cnpjConsultado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }

    /* 1) Certificado ------------------------------------------------------- */
    const cert = await buscarCertificado(certificadoId);
    if (!cert) return res.status(404).json({ error: 'Certificado não encontrado' });

    const pfxBuffer       = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado = cert.senha_certificado;

    /* 2) ( logs de diagnóstico, não usados mais ) ------------------------- */
    const CA_PATH = path.resolve(__dirname, '../certs/ca-bundle.pem');
    const caBundleInline = fs.readFileSync(CA_PATH);
    console.log('> caBundleInline.length =', caBundleInline.length);
    console.log('> pfxBuffer.length       =', pfxBuffer.length);

    /* 3) XML de requisição ------------------------------------------------- */
    const xmlDist = createDistDFeIntXML({
      tpAmb   : ambiente === 'producao' ? '1' : '2',
      cUFAutor: '35',
      CNPJ    : cnpjConsultado,
      ultNSU  : '000000000000000',
    });

    /* 4) Chamada ao web‑service ------------------------------------------- */
    const respostaXml = await consultarDistribuicaoDFe({
      certificadoBuffer: pfxBuffer,
      senhaCertificado,
      xmlDist,
      ambiente,
      // se quiser, pode passar httpsAgentOverride personalizado
    });

    /* 5) Parse e resposta -------------------------------------------------- */
    const resultado = await parseResponse(respostaXml);

    return res.json({
      success    : true,
      totalFound : resultado.docs.length,
      totalSaved : resultado.docs.length,   // ajuste se salvar menos
      ...resultado,
    });

  } catch (e) {
    console.error('> [ROTA] Erro ao consultar SEFAZ:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
