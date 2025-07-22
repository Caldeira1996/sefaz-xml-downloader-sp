// Dependências
const axios = require('axios');
const https = require('https');

// 1. Já tem:
function createAgentFromBuffer(bufferPfx, senha) {
  return new https.Agent({
    pfx: bufferPfx,
    passphrase: senha,
    rejectUnauthorized: true,
  });
}

// 2. DEFINA ESTA FUNÇÃO:
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>${distNSU}</distNSU>
</distDFeInt>`;
}

// 3. DEFINA ESTA FUNÇÃO:
async function consultarDistribuicaoDFe({ certificadoBuffer, senhaCertificado, xmlAssinado, ambiente }) {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);

  const url = ambiente === 'producao'
    ? 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
    : 'https://homologacao.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

  // Monta o envelope SOAP com o XML assinado dentro de CDATA
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

  const response = await axios.post(url, envelopeSoap, {
    httpsAgent,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
    },
    timeout: 15000,
  });

  return response.data;
}

// 4. Função de status (mantém igual já fez)
function createStatusServicoXML({ tpAmb, cUF }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <cUF>${cUF}</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`;
}

// 5. Função de consulta de status (mantém igual já fez)
async function consultarStatusSefaz(certificadoBuffer, senhaCertificado, ambiente, cUF = '35') {
  const httpsAgent = createAgentFromBuffer(certificadoBuffer, senhaCertificado);
  const tpAmb = ambiente === 'producao' ? '1' : '2';

  const url = ambiente === 'producao'
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
    const response = await axios.post(url, envelopeSoap, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 15000,
    });

    // Pega o XML de resposta como string
    const xmlResposta = response.data;

    // Regex simples só para pegar o cStat e xMotivo do XML
    const cStat = (xmlResposta.match(/<cStat>(\d+)<\/cStat>/) || [])[1] || null;
    const xMotivo = (xmlResposta.match(/<xMotivo>(.+?)<\/xMotivo>/) || [])[1] || null;

    return {
      sucesso: cStat === '107' || cStat === '108' || cStat === '109' || cStat === '111',
      statusCode: cStat,
      motivo: xMotivo,
      raw: xmlResposta,
    };
  } catch (e) {
    return {
      sucesso: false,
      error: e.message,
    };
  }
}

// Agora o EXPORT:
module.exports = {
  createAgentFromBuffer,
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  createStatusServicoXML,
  consultarStatusSefaz,
};
