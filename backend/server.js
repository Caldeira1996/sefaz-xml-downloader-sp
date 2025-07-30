// server.js  – configura somente o Express (HTTPS é feito em server-https.js)
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const fs         = require('fs');

const uploadCertRouter    = require('./routes/upload-cert');
const sefazConsultaRouter = require('./routes/sefaz-consulta');
const certificadosRouter  = require('./routes/certificados');
const sefazStatusRouter   = require('./routes/sefazStatus');
const sefazDownloadRouter = require('./routes/sefaz-download');

const app = express();

/* -------------------------------  CORS  ----------------------------------- */
app.use(cors({
  origin: (origin, cb) => {
    console.log('🌐 Requisição recebida de Origin:', origin);
    const allowed = [
      'https://www.xmlprodownloader.com.br',
      'https://xmlprodownloader.com.br',
      'http://localhost:5173',
      'http://localhost:3000',
      'https://localhost:3000',
    ];
    if (!origin || allowed.includes(origin)) return cb(null, origin);
    cb(new Error('Origem não autorizada pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

/* --------------------------  Middlewares padrão  -------------------------- */
app.use(bodyParser.json());
app.use(express.json());

/* --------------------------------  Rotas  -------------------------------- */
app.use('/api/certificados', certificadosRouter);
app.use('/api/sefaz',        sefazConsultaRouter);
app.use('/api/sefaz',        sefazDownloadRouter);
app.use('/api/status',       sefazStatusRouter);
app.use('/',                 uploadCertRouter);

/* -----------------------------  Health check  ----------------------------- */
app.get('/health', (_, res) => {
  res.json({
    status   : 'OK',
    servidor : 'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente : process.env.NODE_ENV || 'development',
  });
});

/* ---------------------------  404 catch‑all  ------------------------------ */
app.use((req, res) => {
  console.warn('404 não capturado:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Rota não encontrada' });
});

/* ------------------  Garante pasta de certificados  ----------------------- */
const dir = process.env.CERTIFICATES_DIR || './certificates';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

module.exports = app;
