// services/sefaz.js
require('dotenv').config();
const axios  = require('axios');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// Carrega o bundle de CA (raiz + intermediária Sectigo)
const caBundle = fs.readFileSync(
  path.join(__dirname, '../certs/ca-bundle.pem'),
  'utf-8'
);

const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

/**
 * Gera o XML puro de <distDFeInt> sem assinatura interna.
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
 * Consulta Distribuição DFe usando mTLS e validando o cert. do servidor.
 */
async function consultarDistribuicaoDFe({ certificadoBuffer, senhaCertificado, xmlDist, ambiente }) {
  const agent = new https.Agent({
    pfx:                certificadoBuffer,
    passphrase:         senhaCertificado,
    ca:                 caBundle,       // bundle da Sectigo
    rejectUnauthorized: false            // valida o certificado do SEFAZ
  });

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        ${xmlDist}
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;

  const url = ambiente === 'producao' ? URL_DIST_PROD : URL_DIST_HOMO;
  const { data } = await axios.post(url, envelope, {
    httpsAgent: agent,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction':    '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"'
    },
    timeout: 30000
  });

  return data;
}

module.exports = { createDistDFeIntXML, consultarDistribuicaoDFe };
