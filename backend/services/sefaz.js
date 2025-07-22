// ────────────────────────────────────────────────────────────────────────────────
// services/sefaz.js
// ────────────────────────────────────────────────────────────────────────────────

// Dependências
const axios = require('axios');
const https = require('https');
const fs   = require('fs');
const path = require('path');

// ── Cadeia de certificados root/intermediários da ICP‑Brasil ───────────────────
//  (AC Soluti EV G4 + Raiz v10) – deixe tudo em certs/ca-chain.pem
const ca = fs.readFileSync(
  path.join(__dirname, '../certs/ca-chain.pem'),
  'utf8'
);

// ── Cria agente HTTPS usando PFX em memória ─────────────────────────────────────
function createAgentFromBuffer(pfxBuffer, senha) {
  return new https.Agent({
    pfx: pfxBuffer,
    passphrase: senha,
    ca,
    rejectUnauthorized: true  // OBRIGATÓRIO em produção!
  });
}

// ── 1) XML para distribuição de DF‑e ────────────────────────────────────────────
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>${distNSU}</distNSU>
</distDFeInt>`;
}

// ── 2) Consulta Distribuição DF‑e ───────────────────────────────────────────────
async function consultarDistribuicaoDFe({
  certificadoBuffer,
  senhaCertificado,
  xmlAssinado,
  ambiente
}) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);

  const url =
    ambiente === 'producao'
      ? 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
      : 'https://homologacao.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

  const envelopeSoap = `
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"
                  xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
  <soapenv:Header/>
  <soapenv:Body>
    <nfe:nfeDadosMsg><![CDATA[
      ${xmlAssinado}
    ]]></nfe:nfeDadosMsg>
  </soapenv:Body>
</soapenv:Envelope>`;

  const { data } = await axios.post(url, envelopeSoap, {
    httpsAgent,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction':
        'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'
    },
    timeout: 15000
  });

  return data;
}

// ── 3) XML para Status do Serviço ──────────────────────────────────────────────
function createStatusServicoXML({ tpAmb, cUF }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <cUF>${cUF}</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`;
}

// ── 4) Consulta Status SEFAZ ───────────────────────────────────────────────────
async function consultarStatusSefaz(
  certificadoBuffer,
  senhaCertificado,
  ambiente,
  cUF = '35'               // 35 = SP
) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const tpAmb = ambiente === 'producao' ? '1' : '2';

  const url =
    ambiente === 'producao'
      ? 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx'
      : 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

  const xml = createStatusServicoXML({ tpAmb, cUF });

  const envelopeSoap = `
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
      <xmlDadosMsg><![CDATA[${xml}]]></xmlDadosMsg>
    </nfeStatusServicoNF>
  </soap12:Body>
</soap12:Envelope>`;

  try {
    // ▸ Requisição à SEFAZ
    const { data: xmlResposta } = await axios.post(url, envelopeSoap, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction':
          'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF'
      },
      timeout: 15000
    });

    // ▸ Parse básico (regex simples)
    const cStat   = (xmlResposta.match(/<cStat>(\d+)<\/cStat>/)   || [])[1] || null;
    const xMotivo = (xmlResposta.match(/<xMotivo>(.+?)<\/xMotivo>/) || [])[1] || null;

    const sucesso = ['107', '108', '109', '111'].includes(cStat);

    return {
      sucesso,
      statusCode: cStat,
      motivo: xMotivo,
      raw: xmlResposta,
      error: sucesso ? null : `[cStat: ${cStat}] ${xMotivo || 'Motivo não informado'}`
    };
  } catch (err) {
    // ▸ Caso a SEFAZ responda HTTP 500, ainda teremos err.response.data
    if (err.response && err.response.data) {
      console.error('Resposta 500 da SEFAZ:', err.response.data);

      return {
        sucesso: false,
        raw: err.response.data,
        error: 'HTTP 500 – erro interno do web‑service'
      };
    }

    // ▸ Erro de rede / timeout
    return {
      sucesso: false,
      error: err.message
    };
  }
}

// ── Exporta funções públicas ───────────────────────────────────────────────────
module.exports = {
  createAgentFromBuffer,
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  createStatusServicoXML,
  consultarStatusSefaz
};
