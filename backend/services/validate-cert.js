// validate-cert.js
const fs    = require('fs');
const https = require('https');
const axios = require('axios');
const path  = require('path');

// Interceptor para logar cada requisição SOAP
axios.interceptors.request.use(conf => {
  if (conf.url.includes('NFeStatusServico4.asmx')) {
    console.log('\n--- REQUISIÇÃO ENVIADA ---');
    console.log('URL     :', conf.url);
    console.log('HEADERS :', conf.headers);
    console.log('BODY(100):', conf.data.slice(0, 100), '...\n');
  }
  return conf;
});

async function validarCertificado(pfxPath, senha) {
  const CERTS_DIR = path.resolve(__dirname, '../certs');
  const caPath    = path.join(CERTS_DIR, 'chain.pem');

  // Verificações de existência de arquivos
  console.log('> [TEST] pfxPath existe?', fs.existsSync(pfxPath), pfxPath);
  console.log('> [TEST] caPath  existe?', fs.existsSync(caPath), caPath);

  const httpsAgent = new https.Agent({
    pfx:                fs.readFileSync(pfxPath),
    passphrase:         senha,
    ca:                 fs.readFileSync(caPath),
    rejectUnauthorized: true,
  });

  // Envelope SOAP 1.2 para Status de Serviço
  const xmlEnvelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap12:Body>' +
        '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">' +
          '<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">' +
            '<tpAmb>1</tpAmb>' +
            '<cUF>35</cUF>' +
            '<xServ>STATUS</xServ>' +
          '</consStatServ>' +
        '</nfeDadosMsg>' +
      '</soap12:Body>' +
    '</soap12:Envelope>';

  const headers = {
    'Content-Type':
      'application/soap+xml; charset=utf-8; ' +
      'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"'
  };

  try {
    const { data } = await axios.post(
      'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      xmlEnvelope,
      { httpsAgent, headers, timeout: 15000 }
    );
    console.log('✅ Resposta validação de certificado:\n', data);
  } catch (err) {
    console.error('❌ Falha na validação do certificado:');
    console.error(err.response?.data || err.message);
  }
}

// Teste rápido
(async () => {
  const CERTS_DIR   = path.resolve(__dirname, '../certs');
  const pfxFilename = '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx';
  const pfxPath     = path.join(CERTS_DIR, pfxFilename);
  const senha       = '123456'; // substitua pela senha correta do seu PFX
  await validarCertificado(pfxPath, senha);
})();
