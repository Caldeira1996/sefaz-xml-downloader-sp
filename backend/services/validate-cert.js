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
      rejectUnauthorized: true, // Coloque true para produção
    });

    // Envelope SOAP 1.2 com xmlDadosMsg
    const xmlEnvelope = `
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
      <xmlDadosMsg><![CDATA[
        <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      ]]></xmlDadosMsg>
    </nfeStatusServicoNF>
  </soap12:Body>
</soap12:Envelope>
`;

    const url = 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 15000,
    });

    return { valido: true, resposta: response.data };
  } catch (err) {
    // Mostra erro detalhado da SEFAZ se tiver
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

// Use assim:
(async () => {
  const pathCert = path.join(__dirname, '../certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
  const senha = '123456'; // SUA SENHA DO PFX
  const result = await validarCertificadoDiretoArquivo(pathCert, senha);
  console.log(result);
})();
