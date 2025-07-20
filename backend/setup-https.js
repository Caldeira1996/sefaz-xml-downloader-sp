// const fs = require('fs');
// const path = require('path');
// const https = require('https');

// const certDir = path.join(__dirname, 'certs');

// const agent = new https.Agent({
//   cert: fs.readFileSync(path.join(certDir, 'client-cert.pem')),
//   key: fs.readFileSync(path.join(certDir, 'client-key.pem')),
//   ca: fs.readFileSync(path.join(certDir, 'ca-chain.pem')), // raiz + intermediário concatenados
//   rejectUnauthorized: true,
//   //passphrase: '123456' // a senha do seu certificado
// });

// // Exporta para ser usado nas requisições à SEFAZ
// module.exports = { agent };


// // ⚠️ Se quiser usar setupHTTPS para montar um servidor local HTTPS:
// const setupHTTPS = () => {
//   const certDir = path.join(__dirname, 'certs');

//   const certPath = path.join(certDir, 'client-cert.pem');
//   const keyPath = path.join(certDir, 'client-key.pem');
//   const caPath = path.join(certDir, 'ca-chain.pem'); // <- atualizado

//   if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(caPath)) {
//     return {
//       cert: fs.readFileSync(certPath),
//       key: fs.readFileSync(keyPath),
//       ca: fs.readFileSync(caPath)
//     };
//   } else {
//     console.log('❌ Alguns certificados SSL não foram encontrados em certs/');
//     return null;
//   }
// };

// module.exports.setupHTTPS = setupHTTPS;


import https from 'https';
import fs from 'fs';
import axios from 'axios';

const httpsAgent = new https.Agent({
  cert: fs.readFileSync('./certs/client-cert.pem'),
  key: fs.readFileSync('./certs/client-key.pem'),
  ca: fs.readFileSync('./certs/ca-chain.pem'),
  rejectUnauthorized: true,
});

const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeStatusServicoNF>
      <!-- seu conteúdo XML -->
    </nfe:nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;

axios.post(
  'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx',
  soapEnvelope,
  {
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
    },
    httpsAgent,
  }
).then(response => {
  console.log(response.data);
}).catch(error => {
  console.error(error.response?.data || error.message);
});
