// services/sefaz.js
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// 1) Use um caminho absoluto para o seu bundle de CAs
const CA_PATH = '/home/ubuntu/sefaz-xml-downloader-sp/backend/certs/ca-bundle.pem';
console.log('> [INIT] Carregando CA bundle de:', CA_PATH);
const caBundle = fs.readFileSync(CA_PATH);

// URLs de produção e homologação
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
    <ultNSU>${ultNSU}</ultNSU>
  </distNSU>
</distDFeInt>`;
}

async function consultarDistribuicaoDFe({ certificadoBuffer, senhaCertificado, xmlDist, ambiente }) {
  // 2) Monte o agent com o caBundle já carregado
  const agent = new https.Agent({
    pfx:                certificadoBuffer,
    passphrase:         senhaCertificado,
    ca:                 caBundle,
    rejectUnauthorized: true
  });

  // 3) DEBUG: confira no log se o bundle e o PFX estão corretos
  console.log('> [DEBUG] caBundle length:', agent.options.ca.length);
  console.log('> [DEBUG] pfx length:      ', agent.options.pfx.length);

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
      'SOAPAction':
        '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"'
    },
    timeout: 30000,
  });

  return data;
}

module.exports = { createDistDFeIntXML, consultarDistribuicaoDFe };
