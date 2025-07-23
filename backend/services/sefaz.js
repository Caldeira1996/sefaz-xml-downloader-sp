// services/sefaz.js
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Endpoints de Distribuição de DF‑e (Produção / Homologação)
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
 * Envia o envelope SOAP 1.1 para Distribuição de DF‑e e retorna o XML de resposta.
 */
async function consultarDistribuicaoDFe({ certificadoBuffer, senhaCertificado, xmlDist, ambiente }) {
  // Carrega a cadeia de CAs (root + intermediárias) no formato PEM
  const ca = fs.readFileSync(path.join(__dirname, '../certs/ca-chain.pem'));

  const agent = new https.Agent({
    pfx: certificadoBuffer,
    passphrase: senhaCertificado,
    ca,                      // confia apenas nessa CA
    rejectUnauthorized: true // agora confere o certificado da SEFAZ
  });

  // Aqui usamos um template literal válido para o envelope
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
      'SOAPAction': '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    },
    timeout: 30000,
  });

  return data;
}

module.exports = { createDistDFeIntXML, consultarDistribuicaoDFe };
