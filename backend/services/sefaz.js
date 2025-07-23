// ────────────────────────────────────────────────────────────────
// services/sefaz.js
//  • Consulta Status‑Serviço  (SOAP 1.2)
//  • Distribuição DF‑e        (SOAP 1.2)
// ────────────────────────────────────────────────────────────────

require('dotenv').config();

const axios  = require('axios');
const https  = require('https');
const tls    = require('node:tls');
const fs     = require('fs');
const path   = require('path');

// 1) Endpoints oficiais (sobrescreva via .env se quiser)
const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ??
  'https://nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ??
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

const URL_STATUS_PROD = process.env.SEFAZ_PRODUCAO_URL ??
  'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';
const URL_STATUS_HOMO = process.env.SEFAZ_HOMOLOGACAO_URL ??
  'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';

// 2) (Opcional) log das requisições SOAP
axios.interceptors.request.use(conf => {
  if (conf.url.includes('StatusServico') || conf.url.includes('DistribuicaoDFe')) {
    console.log('\n--- REQ ENVIADA ---');
    console.log('URL          :', conf.url);
    console.log('Content-Type :', conf.headers['Content-Type'] || conf.headers['content-type']);
  }
  return conf;
});

// 3) Cria https.Agent a partir do PFX em memória
function createAgentFromBuffer(pfxBuffer, senha) {
  // Valida o PKCS#12 (lança se senha errada ou RC2/RC4 em Node 18+/OpenSSL 3)
  tls.createSecureContext({ pfx: pfxBuffer, passphrase: senha });

  const caPem = fs.readFileSync(
    path.join(__dirname, '../certs/ca-chain.pem'),
    'utf8'
  );

  return new https.Agent({
    pfx:                pfxBuffer,
    passphrase:         senha,
    ca:                 caPem,
    rejectUnauthorized: true,
  });
}

// 4) Gera <distDFeInt> XML
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>${distNSU}</distNSU>
</distDFeInt>`;
}

// 5) Distribuição DF‑e
async function consultarDistribuicaoDFe({
  certificadoBuffer,
  senhaCertificado,
  xmlAssinado,
  ambiente = 'producao',
}) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const url        = ambiente === 'producao' ? URL_DIST_PROD : URL_DIST_HOMO;

  const envelopeSoap = `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfe:nfeDadosMsg xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><![CDATA[
      ${xmlAssinado}
    ]]></nfe:nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`.trim();

  const { data } = await axios.post(url, envelopeSoap, {
    httpsAgent,
    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; ' +
        'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
    },
    timeout: 15000,
  });

  return data;
}

// 6) Status Serviço
async function consultarStatusSefaz(
  certificadoBuffer,
  senhaCertificado,
  ambiente = 'producao',
  cUF = '35'
) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const tpAmb      = ambiente === 'producao' ? '1' : '2';
  const url        = ambiente === 'producao' ? URL_STATUS_PROD : URL_STATUS_HOMO;

  const xmlDados = `
<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <cUF>${cUF}</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`;

  const envelopeSoap = `
<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      ${xmlDados}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`.trim();

  const { data: xmlResposta } = await axios.post(url, envelopeSoap, {
    httpsAgent,
    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; ' +
        'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
    },
    timeout: 15000,
  });

  const cStat   = (xmlResposta.match(/<cStat>(\d+)<\/cStat>/)       || [])[1] || null;
  const xMotivo = (xmlResposta.match(/<xMotivo>([^<]+)<\/xMotivo>/) || [])[1] || null;
  const sucesso = ['107', '108', '109', '111'].includes(cStat);

  return {
    sucesso,
    statusCode: cStat,
    motivo: xMotivo,
    raw: xmlResposta,
    error: sucesso ? null : `[cStat: ${cStat}] ${xMotivo || 'Motivo não informado'}`,
  };
}

module.exports = {
  createAgentFromBuffer,
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  consultarStatusSefaz,
};
