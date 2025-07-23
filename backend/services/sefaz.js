// services/sefaz.js
// ────────────────────────────────────────────────────────────────
//  • Consulta Status‑Serviço  (SOAP 1.2)
//  • Distribuição DF‑e        (SOAP 1.2)
//  • Usa certificado A1 (PFX) via HTTPS Client Certificate
// ────────────────────────────────────────────────────────────────

require('dotenv').config();
const axios = require('axios');
const https = require('https');
const tls   = require('node:tls');

// Endpoints, sobrescritos pelo .env
const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

const URL_STATUS_PROD = process.env.SEFAZ_PRODUCAO_URL ||
  'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';
const URL_STATUS_HOMO = process.env.SEFAZ_HOMOLOGACAO_URL ||
  'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';

// (Opcional) log das requisições SOAP
axios.interceptors.request.use(conf => {
  if (conf.url.includes('NFeDistribuicaoDFe') || conf.url.includes('StatusServico')) {
    console.log('\n--- REQ ENVIADA ---');
    console.log('URL          :', conf.url);
    console.log('Content-Type :', conf.headers['Content-Type'] || conf.headers['content-type']);
    console.log('BODY (início):', conf.data.slice(0, 200).replace(/\n/g, ' '), '…\n');
  }
  return conf;
});

// Cria https.Agent a partir do PFX em memória
function createAgentFromBuffer(pfxBuffer, passphrase) {
  // valida PFX
  tls.createSecureContext({ pfx: pfxBuffer, passphrase });
  return new https.Agent({
    pfx:                pfxBuffer,
    passphrase,
    // em produção, deixe true e configure CA corretamente:
    rejectUnauthorized: false,
  });
}

// Gera <distDFeInt> XML “puro”
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

// Distribuição DF‑e (SOAP 1.2, mTLS)
async function consultarDistribuicaoDFe({
  certificadoBuffer,
  senhaCertificado,
  xmlAssinado,
  ambiente = 'producao',
}) {
  const agent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const url   = ambiente === 'producao' ? URL_DIST_PROD : URL_DIST_HOMO;

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <![CDATA[${xmlAssinado}]]>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

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

// Status‑Serviço (SOAP 1.2, mTLS)
async function consultarStatusSefaz(
  certificadoBuffer,
  senhaCertificado,
  ambiente = 'producao',
  cUF = '35'
) {
  const agent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const url   = ambiente === 'producao' ? URL_STATUS_PROD : URL_STATUS_HOMO;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${tpAmb}</tpAmb>
        <cUF>${cUF}</cUF>
        <xServ>STATUS</xServ>
      </consStatServ>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

  const { data: resp } = await axios.post(url, xml, {
    httpsAgent: agent,
    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; ' +
        'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
    },
    timeout: 15000,
  });

  return resp;
}

module.exports = {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  consultarStatusSefaz,
};
