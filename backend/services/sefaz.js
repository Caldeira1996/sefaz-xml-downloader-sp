// services/sefaz.js
require('dotenv').config();
const axios = require('axios');
const { createMtlsAgent } = require('../lib/tlsConfig');

/* -----------------------------------------------------
 * Endpoints
 * --------------------------------------------------- */
const URL_STATUS_PROD = process.env.SEFAZ_STATUS_PROD_URL ||
  'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';
const URL_STATUS_HOMO = process.env.SEFAZ_STATUS_HOMO_URL ||
  'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';

const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

/* -----------------------------------------------------
 * XML helper – Distribuição DF‑e
 * --------------------------------------------------- */
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

/* -----------------------------------------------------
 * Distribuição DF‑e
 * --------------------------------------------------- */
async function consultarDistribuicaoDFe({
  certificadoBuffer,
  certificadoFilename,
  senhaCertificado,
  xmlDist,
  ambiente = 'producao',
}) {

  // Se vier buffer, usa; senão usa filename
  const certInput = certificadoBuffer || certificadoFilename;

  const httpsAgent = createMtlsAgent(certInput, senhaCertificado);

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
    timeout: 30000,
    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    },
  });

  return data; // XML de resposta
}

/* -----------------------------------------------------
 * Status do Serviço
 * --------------------------------------------------- */
async function consultarStatusSefaz({
  certificadoFilename,
  certificadoBuffer,          // ← novo
  senhaCertificado,
  ambiente = 'producao',
}) {
  const certInput = certificadoBuffer || certificadoFilename;

  const httpsAgent = createMtlsAgent(certInput, senhaCertificado);

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <nfeDadosMsg><![CDATA[
        <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <tpAmb>${ambiente === 'producao' ? 1 : 2}</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      ]]></nfeDadosMsg>
    </nfeStatusServicoNF>
  </soap12:Body>
</soap12:Envelope>`;

  const url = ambiente === 'producao' ? URL_STATUS_PROD : URL_STATUS_HOMO;
  const { data } = await axios.post(url, envelope, {
    httpsAgent,
    timeout: 30000,
    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
    },
  });

  return data; // XML de resposta
}

/* -----------------------------------------------------
 * Exports
 * --------------------------------------------------- */
module.exports = {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  consultarStatusSefaz,
};
