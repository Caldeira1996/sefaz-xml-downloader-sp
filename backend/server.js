const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const caCert = fs.readFileSync('./certs/sefaz-intermediate.pem');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

const allowedOrigins = [
  'https://www.xmlprodownloader.com.br',
  'https://xmlprodownloader.com.br',
  'http://localhost:5173',
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não autorizada pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// Supabase client para validar tokens
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const certificatesDir = process.env.CERTIFICATES_DIR || './certificates';
if (!fs.existsSync(certificatesDir)) {
  fs.mkdirSync(certificatesDir, { recursive: true });
}

// Middleware valida token
const validateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token de autorização necessário' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token inválido' });

    req.user = user;
    next();
  } catch (error) {
    console.error('Erro na validação do token:', error);
    res.status(401).json({ error: 'Erro na autenticação' });
  }
};

// Função que faz a consulta SOAP ao SEFAZ com certificado
async function consultarStatusSEFAZ(sefazUrl, certificadoPfx, senhaPfx, ambiente = 'homologacao') {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <soap:Body>
      <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
        <nfeDadosMsg>
          <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
            <tpAmb>${ambiente === 'producao' ? '1' : '2'}</tpAmb>
            <cUF>35</cUF>
            <xServ>STATUS</xServ>
          </consStatServ>
        </nfeDadosMsg>
      </nfeStatusServicoNF>
    </soap:Body>
  </soap:Envelope>`;

  const httpsAgent = new https.Agent({
    pfx: certificadoPfx,
    passphrase: senhaPfx,
    rejectUnauthorized: true,
    ca: caCert,
  });

  const response = await axios.post(sefazUrl, envelope, {
    httpsAgent,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
      'User-Agent': 'Mozilla/5.0 (compatible; SEFAZ-Client/1.0)',
    },
    timeout: 15000,
  });

  return response.data;
}

// Rota para consultar status SEFAZ (real)
app.post('/api/sefaz/status', validateToken, async (req, res) => {
  try {
    const { ambiente = 'homologacao', certificadoId } = req.body;

    if (!certificadoId) {
      return res.status(400).json({ success: false, error: 'certificadoId é obrigatório' });
    }

    // Buscar certificado no banco Supabase
    const { data: certificado, error } = await supabase
      .from('certificados')
      .select('*')
      .eq('id', certificadoId)
      .eq('user_id', req.user.id)
      .single();

    if (error || !certificado) {
      return res.status(404).json({ success: false, error: 'Certificado não encontrado ou não autorizado' });
    }

    // Carregar PFX do disco
    const certificadoPfx = fs.readFileSync(path.join(certificatesDir, certificado.filename));
    const senhaPfx = certificado.password;

    const sefazUrl = ambiente === 'producao'
      ? process.env.SEFAZ_PRODUCAO_URL
      : process.env.SEFAZ_HOMOLOGACAO_URL;

    const soapResponseXml = await consultarStatusSEFAZ(sefazUrl, certificadoPfx, senhaPfx, ambiente);

    xml2js.parseString(soapResponseXml, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('Erro ao parsear XML da SEFAZ:', err);
        return res.status(500).json({ success: false, error: 'Erro ao interpretar resposta da SEFAZ' });
      }
      res.json({
        success: true,
        ambiente,
        sefazUrl,
        resposta: result,
        rawXml: soapResponseXml,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error('Erro ao consultar status SEFAZ:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Outras rotas (ex: upload certificado) podem ficar aqui

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    servidor: 'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development'
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});
