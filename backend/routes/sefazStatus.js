// routes/sefazStatus.js
const express = require('express');
const { XMLParser } = require('fast-xml-parser');

const { buscarCertificadoPrincipal } = require('../services/certificados');
const { consultarStatusSefaz }       = require('../services/sefaz');

const router = express.Router();

// ping simples
router.get('/', (_req, res) => {
  res.json({
    status    : 'OK',
    servidor  : 'Proxy SEFAZ SP',
    timestamp : new Date().toISOString(),
    ambiente  : process.env.NODE_ENV || 'development',
  });
});

router.post('/', async (req, res) => {
  try {
    const ambiente = req.body.ambiente || 'producao';

    // certificado principal salvo no banco
    const cert = await buscarCertificadoPrincipal();
    if (!cert)
      return res
        .status(404)
        .json({ success: false, error: 'Nenhum certificado cadastrado' });

    const certificadoBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado  = cert.senha_certificado;

    // chama o web‑service
    const xmlResp = await consultarStatusSefaz({
      certificadoBuffer,
      senhaCertificado,
      ambiente,
    });

    // parseia o XML (pega tpAmb, cStat, xMotivo…)
     const parser = new XMLParser({
      ignoreAttributes : false,
      ignoreNameSpace  : true   //  <<<<<<  ESSA LINHA FAZ A DIFERENÇA
    });

    const parsed  = parser.parse(xmlResp);
    const ret     = parsed.Envelope?.Body?.nfeResultMsg?.retConsStatServ;
//  ----------------------------------------------

    if (!ret) {
      return res.status(502).json({
        success : false,
        error   : 'Resposta inesperada da SEFAZ',
        raw     : xmlResp            // devolve para depuração
      });
    }

    return res.json({
      success   : true,
      ambiente  : ambiente,
      cStat     : ret.cStat,
      xMotivo   : ret.xMotivo,
      tpAmb     : ret.tpAmb,
      verAplic  : ret.verAplic,
      dhRecbto  : ret.dhRecbto,
      tMed      : ret.tMed
    });
  } catch (err) {
    console.error('Erro /api/status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
