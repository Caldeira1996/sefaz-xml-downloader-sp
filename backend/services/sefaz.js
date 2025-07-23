// ────────────────────────────────────────────────────────────────────────────────
// services/sefaz.js
// Requisita SEFAZ (Status‑Serviço e Distribuição DF‑e) com certificado A1
// ────────────────────────────────────────────────────────────────────────────────

const axios  = require('axios');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ── loga toda requisição SOAP para debug (opcional) ─────────────────────────────
axios.interceptors.request.use(conf => {
  if (conf.url.includes('NFeStatusServico4.asmx') ||
      conf.url.includes('NFeDistribuicaoDFe.asmx')) {
    console.log('\n--- REQ ENVIADA ---');
    console.log('URL          :', conf.url);
    console.log('Content-Type :', conf.headers['Content-Type'] || conf.headers['content-type']);
    console.log('Primeiros 120 bytes do body:\n', conf.data.slice(0, 120), '...\n');
  }
  return conf;
});

/*────────────────────────────────────────────────────────────────────────────────
  Helper: cria um https.Agent a partir do PFX e sempre lê a cadeia de CA
────────────────────────────────────────────────────────────────────────────────*/
function createAgentFromBuffer(pfxBuffer, senha) {
  // lê o arquivo CA toda vez → evita restart quando trocar o PEM
  const ca = fs.readFileSync(
    path.join(__dirname, '../certs/ca-chain.pem'),
    'utf8'
  );

  return new https.Agent({
    pfx            : pfxBuffer,
    passphrase     : senha,
    ca,
    rejectUnauthorized: true       // obrigatório em produção
  });
}

/*───────────────────────────────────────────────────────────────────────────────
  1) XML helper para Distribuição DF‑e
───────────────────────────────────────────────────────────────────────────────*/
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>${distNSU}</distNSU>
</distDFeInt>`;
}

/*───────────────────────────────────────────────────────────────────────────────
  1) Consulta Distribuição DF‑e  (SOAP 1.2)
───────────────────────────────────────────────────────────────────────────────*/
async function consultarDistribuicaoDFe({
  certificadoBuffer,
  senhaCertificado,
  xmlAssinado,
  ambiente
}) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);

  const url = ambiente === 'producao'
    ? 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
    : 'https://homologacao.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

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
        'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"'
    },
    timeout: 15000
  });

  return data;
}

/*───────────────────────────────────────────────────────────────────────────────
  2) Consulta Status do Serviço (SOAP 1.2  – igual ao validate‑cert.js)
───────────────────────────────────────────────────────────────────────────────*/
async function consultarStatusSefaz(
  certificadoBuffer,
  senhaCertificado,
  ambiente,
  cUF = '35'           // 35 = SP
) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const tpAmb      = ambiente === 'producao' ? '1' : '2';

  const url = ambiente === 'producao'
    ? 'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx'
    : 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';

  const xmlDados =
    `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<cUF>${cUF}</cUF>` +
      `<xServ>STATUS</xServ>` +
    `</consStatServ>`;

  const envelopeSoap =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap12:Body>' +
        '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">' +
          xmlDados +
        '</nfeDadosMsg>' +
      '</soap12:Body>' +
    '</soap12:Envelope>';

  try {
    const { data: xmlResposta } = await axios.post(url, envelopeSoap, {
      httpsAgent,
      headers: {
        'Content-Type':
          'application/soap+xml; charset=utf-8; ' +
          'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"'
      },
      timeout: 15000
    });

    const cStat   = (xmlResposta.match(/<cStat>(\d+)<\/cStat>/)   || [])[1] || null;
    const xMotivo = (xmlResposta.match(/<xMotivo>([^<]+)<\/xMotivo>/)|| [])[1] || null;
    const sucesso = ['107', '108', '109', '111'].includes(cStat);

    return {
      sucesso,
      statusCode: cStat,
      motivo: xMotivo,
      raw: xmlResposta,
      error: sucesso ? null : `[cStat: ${cStat}] ${xMotivo || 'Motivo não informado'}`
    };
  } catch (err) {
    if (err.response?.data) {
      console.error('Resposta 500 da SEFAZ:', err.response.data);
      return { sucesso: false, raw: err.response.data, error: 'HTTP 500 – erro SEFAZ' };
    }
    return { sucesso: false, error: err.message };
  }
}

/*───────────────────────────────────────────────────────────────────────────────
  Exporta
───────────────────────────────────────────────────────────────────────────────*/
module.exports = {
  createAgentFromBuffer,
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  consultarStatusSefaz
};
