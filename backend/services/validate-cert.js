// services/validate‑cert.js
const fs    = require('fs');
const https = require('https');
const axios = require('axios');
const path  = require('path');

// Intercepta e loga cada requisição SOAP de status‑serviço
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
  // Ajuste: CA em certs/, PFX em certificates/
  const CA_DIR  = path.resolve(__dirname, '../certs');
  const PFX_DIR = path.resolve(__dirname, '../certificates');

  const caPath  = path.join(CA_DIR, 'chain.pem');

  // DEBUG de existência
  console.log('> CA_DIR  =', CA_DIR);
  console.log('> caPath  =', caPath, fs.existsSync(caPath));
  console.log('> PFX_DIR =', PFX_DIR);
  console.log('> pfxPath =', pfxPath, fs.existsSync(pfxPath));

  const httpsAgent = new https.Agent({
    pfx:                fs.readFileSync(pfxPath),
    passphrase:         senha,
    ca:                 fs.readFileSync(caPath),
    rejectUnauthorized: true,
  });

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
;(async () => {
  const PFX_FILENAME = '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx';
  const PFX_DIR      = path.resolve(__dirname, '../certificates');
  const pfxPath      = path.join(PFX_DIR, PFX_FILENAME);
  const senha        = '123456'; // coloque aqui a senha correta

  await validarCertificado(pfxPath, senha);
})();
