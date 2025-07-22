const fs = require('fs');
const https = require('https');
const axios = require('axios');
const path = require('path');

async function validarCertificadoDiretoArquivo(pfxFilePath, senhaCertificado) {
  try {
    const certificadoBuffer = fs.readFileSync(pfxFilePath);
    const httpsAgent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: senhaCertificado,
      rejectUnauthorized: false, // pode deixar true para produção
    });

    const xmlEnvelope = `<?xml version="1.0" encoding="utf-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
        <soap:Header/>
        <soap:Body>
          <nfe:nfeStatusServicoNF>
            <nfe:versao>4.00</nfe:versao>
            <nfe:tpAmb>1</nfe:tpAmb>
            <nfe:cUF>35</nfe:cUF>
            <nfe:xServ>STATUS</nfe:xServ>
          </nfe:nfeStatusServicoNF>
        </soap:Body>
      </soap:Envelope>`;

    const url = 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 10000,
    });

    return { valido: true, resposta: response.data };
  } catch (err) {
    return { valido: false, erro: err.message };
  }
}

// Use assim:
(async () => {
  const pathCert = path.join(__dirname, '../certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
  const senha = '123456';
  const result = await validarCertificadoDiretoArquivo(pathCert, senha);
  console.log(result);
})();
