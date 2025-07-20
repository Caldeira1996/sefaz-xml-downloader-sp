// sefaz-request.js
const https = require('https');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const certDir = path.join(__dirname, 'certs');

const httpsAgent = new https.Agent({
  cert: fs.readFileSync(path.join(certDir, 'client-cert.pem')),
  key: fs.readFileSync(path.join(certDir, 'client-key.pem')),
  ca: fs.readFileSync(path.join(certDir, 'ca-chain.pem')),
  rejectUnauthorized: true,
});

const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeStatusServicoNF>
      <nfe:xmlDados>
        <![CDATA[
          <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
            <tpAmb>1</tpAmb>
            <cUF>35</cUF>
            <xServ>STATUS</xServ>
          </consStatServ>
        ]]>
      </nfe:xmlDados>
    </nfe:nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;

axios.post(
  'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx',
  soapEnvelope,
  {
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF'
    },
    httpsAgent,
  }
).then(response => {
  console.log(response.data);
}).catch(error => {
  console.error('❌ Erro ao se comunicar com a SEFAZ:');
  console.error(error.response?.data || error.message);
});
