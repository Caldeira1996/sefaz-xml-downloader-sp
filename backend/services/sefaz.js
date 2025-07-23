// services/sefaz.js
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const tls   = require('node:tls');

// URL’s de Distribuição (pode sobrescrever no .env)
const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

// Log de debug
axios.interceptors.request.use(conf => {
  if (conf.url.includes('NFeDistribuicaoDFe')) {
    console.log('\n--- REQ ENVIADA ---');
    console.log('URL :', conf.url);
    console.log('BODY (início):', conf.data.slice(0,200).replace(/\s+/g,' '), '…\n');
  }
  return conf;
});

// Cria um https.Agent com o PFX
function createAgentFromBuffer(pfxBuffer, passphrase) {
  tls.createSecureContext({ pfx: pfxBuffer, passphrase });
  return new https.Agent({
    pfx:                pfxBuffer,
    passphrase,
    rejectUnauthorized: false, // em prod deixe true e configure CA
  });
}

// Gera o XML “puro” de <distDFeInt>
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

// Envia o Envelope SOAP para Distribuição DFe
async function consultarDistribuicaoDFe({
  certificadoBuffer,
  senhaCertificado,
  xmlAssinado,   // só <distDFeInt>…</distDFeInt> com signature
  ambiente = 'producao',
}) {
  const agent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const url   = ambiente === 'producao' ? URL_DIST_PROD : URL_DIST_HOMO;

  const envelope = `
<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <![CDATA[
          ${xmlAssinado}
        ]]>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`.trim();

  const { data } = await axios.post(url, envelope, {
    httpsAgent: agent,
    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; ' +
        'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    },
    timeout: 15000,
  });

  return data;
}

module.exports = {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
};
