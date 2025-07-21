require('dotenv').config();
const express = require('express');
const cors = require('cors');
const uploadCertRouter = require('./routes/upload-cert')

// Importa as rotas (que você deve ter separado em arquivos na pasta routes)
const sefazConsultaRoutes = require('./routes/sefaz-consulta');
const certificadosRoutes = require('./routes/certificados'); // Caso crie essa rota para upload

const app = express();

app.use('/', uploadCertRouter);

const PORT = process.env.PORT || 3001;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

const allowedOrigins = [
  'https://www.xmlprodownloader.com.br',
  'https://xmlprodownloader.com.br',
  'http://localhost:5173', // desenvolvimento local
];

// Configura CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // curl, postman etc
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não autorizada pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// Rota raiz simples
app.get('/', (req, res) => {
  res.send('Backend SEFAZ rodando OK!');
});

// Rotas principais
app.use('/api/sefaz', sefazConsultaRoutes);
app.use('/api/certificados', certificadosRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    servidor: 'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development',
  });
});

// Cria o diretório de certificados caso não exista (opcional)
const fs = require('fs');
const certificatesDir = process.env.CERTIFICATES_DIR || './certificates';
if (!fs.existsSync(certificatesDir)) {
  fs.mkdirSync(certificatesDir, { recursive: true });
}

// Inicializa servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
