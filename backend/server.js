const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const path = require('path');
const soap = require('soap');
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
  'http://localhost:5173', // opcional para desenvolvimento
];

// Middleware CORS
app.use(cors({
  origin: function(origin, callback) {
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

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Diretório certificados
const certificatesDir = process.env.CERTIFICATES_DIR || './certificates';
if (!fs.existsSync(certificatesDir)) {
  fs.mkdirSync(certificatesDir, { recursive: true });
}

// Middleware para validar token
const validateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autorização necessário' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erro na validação do token:', error);
    res.status(401).json({ error: 'Erro na autenticação' });
  }
};

// Sua lógica, funções, rotas aqui (igual você já fez)

// Função para carregar certificado
const loadCertificate = (certificadoPath, senha) => {
  try {
    if (!fs.existsSync(certificadoPath)) {
      throw new Error('Arquivo de certificado não encontrado');
    }

    // Carregar certificado PFX/P12
    const certBuffer = fs.readFileSync(certificadoPath);
    
    return {
      pfx: certBuffer,
      passphrase: senha
    };
  } catch (error) {
    console.error('Erro ao carregar certificado:', error);
    throw error;
  }
};

// Função para criar envelope SOAP para consulta de status
const createStatusEnvelope = () => {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <nfeDadosMsg>
        <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <tpAmb>2</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfeDadosMsg>
    </nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;
};

// Rota para verificar status da SEFAZ
app.post('/api/sefaz/status', validateToken, async (req, res) => {
  try {
    const { ambiente = 'homologacao' } = req.body;
    
    console.log('🔍 Verificando status SEFAZ SP - Ambiente:', ambiente);
    
    const sefazUrl = ambiente === 'producao' 
      ? process.env.SEFAZ_PRODUCAO_URL 
      : process.env.SEFAZ_HOMOLOGACAO_URL;

    // Verificar conectividade básica primeiro
    const connectivityTest = new Promise((resolve, reject) => {
      const url = new URL(sefazUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'GET',
        timeout: 10000,
        ca: caCert,
      };

      const req = https.request(options, (res) => {
        resolve({
          success: true,
          statusCode: res.statusCode,
          headers: res.headers
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout na conexão'));
      });

      req.end();
    });

    try {
      const result = await connectivityTest;
      
      res.json({
        success: true,
        ambiente: ambiente,
        url: sefazUrl,
        conectividade: {
          status: 'OK',
          statusCode: result.statusCode,
          servidor: result.headers.server || 'Desconhecido'
        },
        timestamp: new Date().toISOString(),
        observacao: 'Conectividade básica OK. Para testes completos, será necessário certificado digital.'
      });
    } catch (error) {
      console.error('Erro na conectividade:', error);
      
      res.json({
        success: false,
        ambiente: ambiente,
        url: sefazUrl,
        error: error.message,
        conectividade: {
          status: 'ERRO',
          detalhes: error.message
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Erro geral:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para consultar NFe
app.post('/api/sefaz/consulta', validateToken, async (req, res) => {
  try {
    const { 
      certificadoId, 
      cnpjConsultado, 
      tipoConsulta, 
      ambiente = 'homologacao',
      dataInicio,
      dataFim 
    } = req.body;

    console.log('🔍 Iniciando consulta SEFAZ - Tipo:', tipoConsulta, 'Ambiente:', ambiente);

    // Buscar dados do certificado no Supabase
    const { data: certificado, error: certError } = await supabase
      .from('certificados')
      .select('*')
      .eq('id', certificadoId)
      .eq('user_id', req.user.id)
      .single();

    if (certError || !certificado) {
      return res.status(404).json({
        success: false,
        error: 'Certificado não encontrado ou não autorizado'
      });
    }

    // Por enquanto, vamos retornar uma simulação melhorada
    // TODO: Implementar consulta real quando o certificado estiver disponível
    console.log('📝 Simulando consulta (certificado não carregado ainda)...');
    
    const totalXmls = Math.floor(Math.random() * 5) + 1;
    const xmlsBaixados = totalXmls;
    
    const resultado = {
      success: true,
      totalXmls,
      xmlsBaixados,
      detalhes: `Consulta simulada realizada com sucesso para CNPJ ${cnpjConsultado}`,
      ambiente: ambiente,
      certificado: {
        nome: certificado.nome,
        cnpj: certificado.cnpj
      },
      diagnostico: {
        servidor: 'Backend Node.js',
        timestamp: new Date().toISOString(),
        observacao: 'Sistema preparado para comunicação real com SEFAZ'
      }
    };

    // Registrar consulta no banco
    const { data: consulta, error: consultaError } = await supabase
      .from('consultas_sefaz')
      .insert({
        user_id: req.user.id,
        certificado_id: certificadoId,
        cnpj_consultado: cnpjConsultado,
        tipo_consulta: tipoConsulta,
        status: 'concluido',
        resultado: resultado,
        total_xmls: totalXmls,
        xmls_baixados: xmlsBaixados
      })
      .select()
      .single();

    if (!consultaError && consulta) {
      // Simular alguns XMLs
      const xmlsSimulados = [];
      for (let i = 0; i < totalXmls; i++) {
        const chaveNfe = `35${new Date().getFullYear()}${cnpjConsultado.padStart(14, '0')}55001${String(i + 1).padStart(9, '0')}${Math.floor(Math.random() * 10)}`;
        
        xmlsSimulados.push({
          consulta_id: consulta.id,
          user_id: req.user.id,
          chave_nfe: chaveNfe,
          numero_nfe: String(1000 + i),
          cnpj_emitente: '12345678000199',
          razao_social_emitente: `Empresa Exemplo ${i + 1} Ltda`,
          data_emissao: new Date().toISOString(),
          valor_total: (Math.random() * 1000 + 100).toFixed(2),
          xml_content: `<NFe><infNFe Id="NFe${chaveNfe}"><ide><cNF>${String(i + 1).padStart(8, '0')}</cNF></ide></infNFe></NFe>`,
          status_manifestacao: 'pendente'
        });
      }

      if (xmlsSimulados.length > 0) {
        await supabase
          .from('xmls_nfe')
          .insert(xmlsSimulados);
      }
    }

    res.json(resultado);

  } catch (error) {
    console.error('Erro na consulta:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para upload de certificado
app.post('/api/certificados/upload', validateToken, async (req, res) => {
  try {
    // TODO: Implementar upload de certificado PFX/P12
    // Por enquanto, apenas confirmamos que o endpoint existe
    
    res.json({
      success: true,
      message: 'Endpoint de upload preparado. Upload de certificados será implementado.',
      observacao: 'Certificados devem ser colocados manualmente na pasta ./certificates por enquanto'
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Exemplo da rota health check
// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    servidor: 'Proxy SEFAZ SP',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development'
  });
});
// No final, exporta o app para o server HTTPS
module.exports = app;

