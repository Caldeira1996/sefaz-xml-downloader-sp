// testa-mtls.js
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// 1) P12 do cliente e senha
const pfxPath  = path.join(__dirname, 'certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
const passphrase = '123456';

// 2) Bundle de CAs (root + intermediárias) que validam o servidor SERPRO
const caBundle = fs.readFileSync(path.join(__dirname, 'certs', 'ca-bundle.pem'));

// 3) Monta o XML mínimo bem-formado
const payload = `<?xml version="1.0" encoding="utf-8"?>
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

// 4) Cria o HTTPS agent com mTLS
const agent = new https.Agent({
  pfx: fs.readFileSync(pfxPath),
  passphrase,
  ca: caBundle,
  rejectUnauthorized: true
});

// 5) Opções da requisição
const options = {
  hostname: 'www1.nfe.fazenda.gov.br',
  path: '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    'Content-Length': Buffer.byteLength(payload)
  },
  agent
};

// 6) Envia
const req = https.request(options, res => {
  console.log('StatusCode:', res.statusCode);
  let data = '';
  res.on('data', chunk => (data += chunk));
  res.on('end', () => {
    console.log('Resposta:', data.substring(0, 500) + '…');
  });
});
req.on('error', err => console.error('Erro:', err));
req.write(payload);
req.end();
