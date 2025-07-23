// server.js
require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const fs         = require('fs');

const uploadCertRouter    = require('./routes/upload-cert');
const sefazConsultaRoutes = require('./routes/sefaz-consulta');
const certificadosRoutes  = require('./routes/certificados');
const sefazStatusRouter   = require('./routes/sefazStatus');
const sefazDownloadRouter = require('./routes/sefaz-download');

const app = express();

app.use(bodyParser.json());
app.use(
  cors({
    origin: (origin, callback) => {
      console.log('🌐 Requisição recebida de Origin:', origin);
      const allowed = [
        'https://www.xmlprodownloader.com.br',
        'https://xmlprodownloader.com.br',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://localhost:3000',
      ];
      if (!origin || allowed.includes(origin)) return callback(null, origin);
      callback(new Error('Origem não autorizada pelo CORS'));
    },
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  })
);
app.use(express.json());

// Rotas de API
app.use('/api/certificados', certificadosRoutes);
app.use('/api/sefaz',          sefazConsultaRoutes);   // consulta DF‑e
app.use('/api/sefaz',          sefazDownloadRouter);   // download XML/zip
app.use('/api/status',         sefazStatusRouter);     // status‑serviço
app.use('/',                   uploadCertRouter);      // upload de PFX

// Health check
app.get('/health', (req, res) => {
  res.json({
    status:    'OK',
    servidor:  'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente:  process.env.NODE_ENV || 'development',
  });
});

// 404 catch‑all
app.use((req, res) => {
  console.warn('404 não capturado:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Garante pasta de certificados
const dir = process.env.CERTIFICATES_DIR || './certificates';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

module.exports = app;
