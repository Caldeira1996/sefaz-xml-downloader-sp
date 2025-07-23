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
app.use(cors({ /* sua config atual */ }));
app.use(express.json());

// Rotas
app.use('/api/certificados', certificadosRoutes);
app.use('/api/sefaz',          sefazConsultaRoutes);
app.use('/api/sefaz',          sefazDownloadRouter);
app.use('/api/status',         sefazStatusRouter);
app.use('/',                   uploadCertRouter);

app.get('/health', (req, res) => {
  res.json({ status:'OK', timestamp: new Date().toISOString() });
});

// 404 catch‑all
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Garantia da pasta de certificados
const dir = process.env.CERTIFICATES_DIR || './certificates';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

module.exports = app;
