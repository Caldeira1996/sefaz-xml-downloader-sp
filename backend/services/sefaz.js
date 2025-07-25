// services/sefaz.js

require('dotenv').config();
const axios  = require('axios');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// Diretórios absolutos para seus certificados
const CERTS_DIR    = path.resolve(__dirname, '../certs');
const PFX_DIR      = path.resolve(__dirname, '../certificates');

// Endpoints de Distribuição DF-e
const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

// Gera o XML de consulta de distribuição
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, ultNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>
    <consNSU>
      <ultNSU>${ultNSU}</ultNSU>
    </consNSU>
  </distNSU>
</distDFeInt>`;
}

/**
 * Faz a chamada de Distribuição DF‑e usando certificado PFX + cadeia de CAs.
 *
 * @param {Object}   opts
 * @param {string}   opts.certificadoFilename  — nome do .pfx em certificates/
 * @param {string}   opts.senhaCertificado     — senha do .pfx
 * @param {string}   opts.xmlDist              — corpo XML gerado por createDistDFeIntXML()
 * @param {'producao'|'homologacao'} opts.ambiente
 */
async function consultarDistribuicaoDFe({ certificadoFilename, senhaCertificado, xmlDist, ambiente }) {
  // monta paths
  const pfxPath = path.join(PFX_DIR, certificadoFilename);
  const caPath  = path.join(CERTS_DIR, 'chain.pem');

  // valida existência
  if (!fs.existsSync(pfxPath)) {
    throw new Error(`Certificado PFX não encontrado em ${pfxPath}`);
  }
  if (!fs.existsSync(caPath)) {
    throw new Error(`CA bundle não encontrado em ${caPath}`);
  }

  // cria agent HTTPS mTLS
  const httpsAgent = new https.Agent({
    pfx:                fs.readFileSync(pfxPath),
    passphrase:         senhaCertificado,
    ca:                 fs.readFileSync(caPath),
    rejectUnauthorized: true,
  });

  // envelopa em SOAP 1.2
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
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

  // escolhe URL
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
