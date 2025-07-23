// services/sefaz.js
// ────────────────────────────────────────────────────────────────
//  • Consulta Status‑Serviço  (SOAP 1.2)
//  • Distribuição DF‑e        (SOAP 1.2)
//  • Usa certificado A1 (PFX) via HTTPS Client Certificate
// ────────────────────────────────────────────────────────────────

require('dotenv').config();
console.log('>>> ENV SEFAZ_DIST_PROD_URL =', process.env.SEFAZ_DIST_PROD_URL);

const axios = require('axios');
const https = require('https');
const tls = require('node:tls');
const fs = require('fs');
const path = require('path');

// 1) Endpoints oficiais (sobrescreva via .env se quiser)
const URL_DIST_PROD = process.env.SEFAZ_DIST_PROD_URL ||
  'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const URL_DIST_HOMO = process.env.SEFAZ_DIST_HOMO_URL ||
  'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

const URL_STATUS_PROD = process.env.SEFAZ_PRODUCAO_URL ||
  'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';
const URL_STATUS_HOMO = process.env.SEFAZ_HOMOLOGACAO_URL ||
  'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';

// 2) (Opcional) log das requisições SOAP
axios.interceptors.request.use(conf => {
  if (conf.url.includes('NFeDistribuicaoDFe') || conf.url.includes('StatusServico')) {
    console.log('\n--- REQ ENVIADA ---');
    console.log('URL          :', conf.url);
    console.log('Content-Type :', conf.headers['Content-Type'] || conf.headers['content-type']);
  }
  return conf;
});

// 3) Cria https.Agent a partir do PFX em memória
// 3) Cria https.Agent a partir do PFX em memória
function createAgentFromBuffer(pfxBuffer, passphrase) {
  // Valida o PKCS#12 (lança se a senha estiver errada ou PFX obsoleto)
  tls.createSecureContext({ pfx: pfxBuffer, passphrase });

  return new https.Agent({
    pfx: pfxBuffer,
    passphrase: passphrase,
    // Para *ignorar* falhas no certificado do servidor (não recomendado em produção!):
    rejectUnauthorized: false,
  });
}


// 4) Gera <distDFeInt> XML “puro” (sem o envelope SOAP)
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>
    ${distNSU}
  </distNSU>
</distDFeInt>`;
}
// 5) Distribuição DF‑e (SOAP 1.2, mTLS)
async function consultarDistribuicaoDFe({
  certificadoBuffer,
  senhaCertificado,
  xmlAssinado,
  ambiente = 'producao',
}) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const url = ambiente === 'producao' ? URL_DIST_PROD : URL_DIST_HOMO;
  console.log(`🔗 Distribuição DF‑e → ${url}`);

  // Envelope SOAP completo com wrapper nfeDistDFeInteresse
  const envelopeSoap = `
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

// 6) Status Serviço (SOAP 1.2, mTLS)
async function consultarStatusSefaz(
  certificadoBuffer,
  senhaCertificado,
  ambiente = 'producao',
  cUF = '35'
) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const url = ambiente === 'producao' ? URL_STATUS_PROD : URL_STATUS_HOMO;
  console.log(`🔗 Status‑Serviço → ${url}`);

  const xmlDados = `
<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <cUF>${cUF}</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`.trim();

  const envelopeSoap = `
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg
      xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
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

  const cStat = (xmlResposta.match(/<cStat>(\d+)<\/cStat>/) || [])[1] || null;
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
