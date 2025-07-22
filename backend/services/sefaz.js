const axios = require('axios');
const https = require('https');

/**
 * Cria um agente HTTPS a partir do buffer do certificado PFX e senha.
 * @param {Buffer} bufferPfx - Buffer do arquivo PFX
 * @param {string} senha - senha do certificado
 * @returns {https.Agent}
 */
function createAgentFromBuffer(bufferPfx, senha) {
  return new https.Agent({
    pfx: bufferPfx,
    passphrase: senha,
    rejectUnauthorized: false,
  });
}

const createStatusEnvelope = () => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <nfeDadosMsg>
        <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <tpAmb>2</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfeDadosMsg>
    </nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;

async function consultarNFe({ certificadoBuffer, senhaCertificado, cnpjConsultado, tipoConsulta, ambiente }) {
  const httpsAgent = new https.Agent({
    pfx: certificadoBuffer,
    passphrase: senhaCertificado,
    rejectUnauthorized: false,
  });

  const url = ambiente === 'producao'
    ? 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx'
    : 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

  const xmlEnvelope = createStatusEnvelope();

  try {
    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    console.error('Erro na consulta SEFAZ:', error);
    throw error;
  }
}

module.exports = {
  createAgentFromBuffer,
  createStatusEnvelope,
  consultarNFe,
};
