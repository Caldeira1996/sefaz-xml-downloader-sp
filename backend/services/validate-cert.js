// services/validate-cert.js
const fs = require('fs');
const https = require('https');
const axios = require('axios');

async function validarCertificado({ certificadoPath, senhaCertificado }) {
  try {
    if (!fs.existsSync(certificadoPath)) {
      return { valido: false, erro: 'Certificado não encontrado no caminho informado' };
    }

    const pfxBuffer = fs.readFileSync(certificadoPath);

    const httpsAgent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: senhaCertificado,
      rejectUnauthorized: false,
    });

    const xmlEnvelope = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
        <soap:Header/>
        <soap:Body>
          <nfe:nfeStatusServicoNF>
            <nfe:versao>4.00</nfe:versao>
            <nfe:tpAmb>2</nfe:tpAmb>
            <nfe:cUF>35</nfe:cUF>
            <nfe:xServ>STATUS</nfe:xServ>
          </nfe:nfeStatusServicoNF>
        </soap:Body>
      </soap:Envelope>
    `;

    const url = 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 10000,
    });

    if (response.status === 200) {
      return { valido: true, resposta: response.data };
    } else {
      return { valido: false, erro: `Resposta inesperada da SEFAZ: ${response.status}` };
    }
  } catch (err) {
    return { valido: false, erro: err.message || 'Erro desconhecido' };
  }
}

module.exports = { validarCertificado };
