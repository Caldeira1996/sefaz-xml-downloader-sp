// services/sefaz.js
require('dotenv').config();
const axios            = require('axios');
const { createMtlsAgent } = require('../lib/tlsConfig');

// Endpoints de Distribuição DF-e
const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, ultNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>
    <consNSU><ultNSU>${ultNSU}</ultNSU></consNSU>
  </distNSU>
</distDFeInt>`;
}

async function consultarDistribuicaoDFe({ certificadoFilename, senhaCertificado, xmlDist, ambiente }) {
  // monta o mTLS agent corretamente
  const httpsAgent = createMtlsAgent(certificadoFilename, senhaCertificado);

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
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
    httpsAgent,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction':
        '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    },
    timeout: 30000,
  });

  return data;
}

module.exports = { createDistDFeIntXML, consultarDistribuicaoDFe };
