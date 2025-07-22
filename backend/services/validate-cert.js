const fs = require('fs');
const https = require('https');
const axios = require('axios');
const path = require('path');

async function validarCertificadoDiretoArquivo(pfxFilePath, senhaCertificado) {
  try {
    // Lê o arquivo .pfx do certificado
    const certificadoBuffer = fs.readFileSync(pfxFilePath);

    // Lê o arquivo com a cadeia de certificados raiz e intermediários (CA chain)
    const ca = fs.readFileSync(path.join(__dirname, '../certs/ca-chain.pem'));

    // Configura o agente HTTPS com o certificado cliente
    const httpsAgent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: senhaCertificado,
      ca: ca,
      rejectUnauthorized: true, // para produção deve ser true
    });

    // XML envelope SOAP 1.1 conforme manual SEFAZ SP
    const xmlEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
  <xmlDadosMsg><![CDATA[
    <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
      <tpAmb>1</tpAmb>
      <cUF>35</cUF>
      <xServ>STATUS</xServ>
    </consStatServ>
  ]]></xmlDadosMsg>
</nfeStatusServicoNF>

  </soap:Body>
</soap:Envelope>`;

    const url = 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

    // Faz a requisição POST ao serviço SEFAZ
    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8', // SOAP 1.1
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 15000,
    });

    // Retorna sucesso e resposta do servidor
    return { valido: true, resposta: response.data };
  } catch (err) {
    if (err.response) {
      // Retorna detalhes do erro vindo do SEFAZ
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

// Executa o teste do certificado
(async () => {
  const pathCert = path.join(__dirname, '../certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
  const senha = '123456'; // sua senha do certificado
  const result = await validarCertificadoDiretoArquivo(pathCert, senha);
  console.log(result);
})();
