require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const uploadCertRouter = require('./routes/upload-cert');
const sefazConsultaRoutes = require('./routes/sefaz-consulta');
const certificadosRoutes = require('./routes/certificados'); // se existir

const app = express();

const allowedOrigins = [
  'https://www.xmlprodownloader.com.br',
  'https://xmlprodownloader.com.br',
  'http://localhost:5173', // para dev local
  'https://api.xmlprodownloader.com.br',
];

// Configura CORS antes das rotas
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // curl/postman sem origin
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin); // <-- aqui, PASSAR a origem, não `true`
    }
    return callback(new Error('Origem não autorizada pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Habilita parsing JSON para ler req.body nas rotas
app.use(express.json());

// Rotas
app.use('/', uploadCertRouter);
app.use('/api/sefaz', sefazConsultaRoutes);
app.use('/api/certificados', certificadosRoutes);

// Rota raiz simples para teste
app.get('/', (req, res) => {
  res.send('Backend SEFAZ rodando OK!');
});

// Health check
app.get('/health/?', (req, res) => {
  res.json({
    status: 'OK',
    servidor: 'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development',
  });
});

// Cria diretório de certificados, caso não exista
const certificatesDir = process.env.CERTIFICATES_DIR || './certificates';
if (!fs.existsSync(certificatesDir)) {
  fs.mkdirSync(certificatesDir, { recursive: true });
}

// Inicializa servidor
const PORT = process.env.PORT || 3001;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});

module.exports = app;
