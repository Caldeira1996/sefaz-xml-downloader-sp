const fs = require('fs');
const https = require('https');
const axios = require('axios');
const path = require('path');

async function validarCertificadoDiretoArquivo(pfxFilePath, senhaCertificado) {
  try {
    const certificadoBuffer = fs.readFileSync(pfxFilePath);
    const ca = fs.readFileSync(path.join(__dirname, '../certs/ca-chain.pem'));

    const httpsAgent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: senhaCertificado,
      ca: ca,
      rejectUnauthorized: true,
    });

    const xmlEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
      <versao>4.00</versao>
      <tpAmb>1</tpAmb>
      <cUF>35</cUF>
      <xServ>STATUS</xServ>
    </nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;

    const url = 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF"',
      },
      timeout: 15000,
    });

    return { valido: true, resposta: response.data };
  } catch (err) {
    if (err.response) {
      return {
        valido: false,
        status: err.response.status,
        data: err.response.data,
        erro: err.message,
      };
    } else {
      return { valido: false, erro: err.message };
    }
  }
}

(async () => {
  const pathCert = path.join(__dirname, '../certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
  const senha = '123456';
  const result = await validarCertificadoDiretoArquivo(pathCert, senha);
  console.log(result);
})();
