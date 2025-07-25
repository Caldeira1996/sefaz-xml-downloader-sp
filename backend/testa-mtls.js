// testa-mtls.js
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Ajuste estes caminhos conforme seu layout:
const PFX_PATH = path.join(__dirname, 'certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
const PFX_PASS = '123456';

// XML mínimo de teste
const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <![CDATA[
          <?xml version="1.0" encoding="UTF-8"?>
          <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
            <tpAmb>1</tpAmb>
            <cUFAutor>35</cUFAutor>
            <CNPJ>52055075000173</CNPJ>
            <distNSU><ultNSU>000000000000000</ultNSU></distNSU>
          </distDFeInt>
        ]]>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;

const agent = new https.Agent({
  pfx: fs.readFileSync(PFX_PATH),
  passphrase: PFX_PASS,
  rejectUnauthorized: false  // desligamos verificação de CA só para isolar o teste
});

const options = {
  hostname: 'www1.nfe.fazenda.gov.br',
  port: 443,
  path: '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"'
  },
  agent
};

const req = https.request(options, res => {
  console.log('statusCode:', res.statusCode);
  res.setEncoding('utf8');
  res.on('data', chunk => process.stdout.write(chunk));
  res.on('end',  ()    => console.log('\n>>> fim da resposta <<<'));
});

req.on('error', err => {
  console.error('❌ Erro TLS ou de conexão:', err);
});

req.write(soapBody);
req.end();
