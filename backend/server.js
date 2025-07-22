require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const uploadCertRouter = require('./routes/upload-cert');
const sefazConsultaRoutes = require('./routes/sefaz-consulta');
const certificadosRoutes = require('./routes/certificados');
const sefazStatusRouter = require('./routes/sefazStatus');
const sefazDownloadRouter = require('./routes/sefaz-download');

const app = express();

app.use(bodyParser.json()); // Necessário para ler JSON no POST

const allowedOrigins = [
  'https://www.xmlprodownloader.com.br',
  'https://xmlprodownloader.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://localhost:3000',
  // Adicione a origem que aparece no erro, se for diferente!
];


app.use(cors({
  origin: function (origin, callback) {
    console.log('🌐 Requisição recebida de Origin:', origin); // ADICIONE ESTA LINHA!
    if (!origin) return callback(null, true); // req sem origin (ex curl/postman)
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin); // Retorna o origin da requisição
    }
    return callback(new Error('Origem não autorizada pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));


// Habilita parsing JSON para ler req.body nas rotas
app.use(express.json());

// Rotas
app.use('/api/certificados', certificadosRoutes);   // <- Primeiras rotas de API
app.use('/api/sefaz', sefazConsultaRoutes);
// app.use('/api/sefaz/status', sefazStatusRouter);
app.use('/api/status', sefazStatusRouter); // chamada de API correta
app.use('/', uploadCertRouter);                      // <- GENÉRICO, DEIXE POR ÚLTIMO!
app.use('/api/sefaz', sefazDownloadRouter);

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
