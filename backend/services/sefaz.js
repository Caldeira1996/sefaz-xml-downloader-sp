// ────────────────────────────────────────────────────────────────────────────────
// services/sefaz.js
// ────────────────────────────────────────────────────────────────────────────────

const axios = require('axios');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Cadeia ICP‑Brasil (AC Soluti EV G4 + Raiz v10)
const ca = fs.readFileSync(path.join(__dirname, '../certs/ca-chain.pem'), 'utf8');

// Agente HTTPS a partir do PFX em buffer
function createAgentFromBuffer(pfxBuffer, senha) {
  return new https.Agent({
    pfx: pfxBuffer,
    passphrase: senha,
    ca,
    rejectUnauthorized: true
  });
}

// ── 1) Distribuição DF‑e (SOAP 1.2) ─────────────────────────────────────────────
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>${distNSU}</distNSU>
</distDFeInt>`;
}

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
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
  <soap:Header/>
  <soap:Body>
    <nfe:nfeDadosMsg><![CDATA[
      ${xmlAssinado}
    ]]></nfe:nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;

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

// ── 2) Status Serviço (SOAP 1.1) ───────────────────────────────────────────────
function createStatusServicoXML({ tpAmb, cUF }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <cUF>${cUF}</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`;
}

// ── 2) Consulta Status do Serviço – VERSÃO FINAL (igual ao validate‑cert.js) ──
async function consultarStatusSefaz(
  certificadoBuffer,
  senhaCertificado,
  ambiente,
  cUF = '35' // SP
) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const tpAmb      = ambiente === 'producao' ? '1' : '2';

  const url = ambiente === 'producao'
    ? 'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx'
    : 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';

  // XML de dados (igual ao validate‑cert.js)
  const xmlDados = `
    <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
      <tpAmb>${tpAmb}</tpAmb>
      <cUF>${cUF}</cUF>
      <xServ>STATUS</xServ>
    </consStatServ>`.trim();

  // Envelope SOAP 1.2 **sem wrapper**:
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
        // igual ao validate‑cert.js – SOAP 1.2 com action
        'Content-Type':
          'application/soap+xml; charset=utf-8; ' +
          'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"'
      },
      timeout: 15000
    });

    const cStat   = (xmlResposta.match(/<cStat>(\d+)<\/cStat>/)   || [])[1] || null;
    const xMotivo = (xmlResposta.match(/<xMotivo>(.+?)<\/xMotivo>/)|| [])[1] || null;
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

// ── Exporta funções ────────────────────────────────────────────────────────────
module.exports = {
  createAgentFromBuffer,
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  createStatusServicoXML,
  consultarStatusSefaz
};
