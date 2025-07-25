// services/sefaz.js
require('dotenv').config();

const axios = require('axios');
const { mtlsAgent } = require('../lib/tlsConfig');

// Endpoints de Distribuição de DFe
const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

/**
 * Gera o XML de DistDFeInt conforme o manual da SEFAZ
 */
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, ultNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>
    <ultNSU>${ultNSU}</ultNSU>
  </distNSU>
</distDFeInt>`;
}

/**
 * Consulta a distribuição de DFe via mTLS
 * @param {Object} params
 * @param {string} params.xmlDist — XML de consulta criado por createDistDFeIntXML
 * @param {'producao'|'homologacao'} params.ambiente
 * @returns {Promise<string>} — resposta SOAP em raw XML
 */
async function consultarDistribuicaoDFe({ xmlDist, ambiente }) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg><![CDATA[
        ${xmlDist}
      ]]></nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;

  const url = ambiente === 'producao' ? URL_DIST_PROD : URL_DIST_HOMO;

  const { data } = await axios.post(url, envelope, {
    httpsAgent: mtlsAgent,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction':
        '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    },
    timeout: 30_000,
  });

  return data;
}

module.exports = {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
};
