// routes/sefazStatus.js
const express           = require('express');
const { XMLParser }     = require('fast-xml-parser');

const { buscarCertificadoPrincipal } = require('../services/certificados');
const { consultarStatusSefaz }       = require('../services/sefaz');

const router = express.Router();

/* --------------------------------------------------
 * GET /api/status            → ping simples
 * POST /api/status {ambiente} → consulta SEFAZ
 * -------------------------------------------------- */

// ping simples – para load‑balancer/uptime‑robot etc.
router.get('/', (_req, res) => {
  res.json({
    status    : 'OK',
    servidor  : 'Proxy SEFAZ SP',
    timestamp : new Date().toISOString(),
    ambiente  : process.env.NODE_ENV || 'development'
  });
});

// consulta status SEFAZ
router.post('/', async (req, res) => {
  try {
    const ambiente = req.body.ambiente || 'producao';

    /* ---------------- certificado A1 ---------------- */
    const cert = await buscarCertificadoPrincipal();
    if (!cert) {
      return res.status(404).json({
        success : false,
        error   : 'Nenhum certificado cadastrado'
      });
    }

    const certificadoBuffer = Buffer.from(cert.certificado_base64, 'base64');
    const senhaCertificado  = cert.senha_certificado;

    /* ---------------- chamada WS -------------------- */
    const xmlResp = await consultarStatusSefaz({
      certificadoBuffer,
      senhaCertificado,
      ambiente
    });

    /* ------------ parse do XML de resposta ---------- */
    const parser = new XMLParser({
      ignoreAttributes : false, // mantém @_
      removeNSPrefix   : true   // remove “soap:”, “nfe:”, etc.
    });

    const parsed = parser.parse(xmlResp);
    // após remover prefixos: Envelope → Body → nfeResultMsg → retConsStatServ
    const ret = parsed.Envelope?.Body?.nfeResultMsg?.retConsStatServ;

    if (!ret) {
      return res.status(502).json({
        success : false,
        error   : 'Resposta inesperada da SEFAZ',
        raw     : xmlResp          // devolve XML para depuração
      });
    }

    /* ------------ resposta p/ frontend -------------- */
    return res.json({
      success   : true,
      ambiente,
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
