// sefaz-request.js
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

// Diretório onde estão seus PEMs de cliente e a cadeia de CAs
const certDir = path.join(__dirname, 'certs');

// Agent HTTPS com mTLS e validação do servidor
const httpsAgent = new https.Agent({
  cert: fs.readFileSync(path.join(certDir, 'client-cert.pem')),
  key:  fs.readFileSync(path.join(certDir, 'client-key.pem')),
  ca:   fs.readFileSync(path.join(certDir, 'chain.pem')),  // ac-soluti + icp-brasil
  rejectUnauthorized: true,  // valida o cert do servidor SEFAZ‑SP
});

const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeStatusServicoNF>
      <xmlDadosMsg><![CDATA[
        <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      ]]></xmlDadosMsg>
    </nfe:nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;

axios.post(
  'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
  soapEnvelope,
  {
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
    },
    httpsAgent,
    timeout: 15000,
  }
)
.then(response => {
  console.log('Resposta SEFAZ Status:', response.data);
})
.catch(error => {
  console.error('❌ Erro ao se comunicar com a SEFAZ:');
  console.error(error.response?.data || error.message);
});
