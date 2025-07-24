// testa-mtls.js
const https = require('https');
const fs    = require('fs');

const PFX_PATH = './certificates/meu-certificado.pfx';
const PFX_PASS = '123456';

const agent = new https.Agent({
  pfx: fs.readFileSync(PFX_PATH),
  passphrase: PFX_PASS,
  rejectUnauthorized: false // DESLIGA validação de CA
});

const opts = {
  hostname: 'www1.nfe.fazenda.gov.br',
  path: '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"'
  },
  agent
};

const req = https.request(opts, res => {
  console.log('statusCode:', res.statusCode);
  res.setEncoding('utf8');
  res.on('data', chunk => process.stdout.write(chunk));
});
req.on('error', err => console.error('Erro TLS:', err));
req.write(fs.readFileSync('dist2.xml'));
req.end();
