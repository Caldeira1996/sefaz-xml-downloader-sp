const axios = require('axios');
const https = require('https');

function createAgentFromBuffer(bufferPfx, senha) {
  return new https.Agent({
    pfx: bufferPfx,
    passphrase: senha,
    rejectUnauthorized: true,
  });
}
/**
 * Monta o XML para consulta de status do serviço SEFAZ SP
 * @param {object} params
 * @param {number} params.tpAmb - Ambiente: 1 (produção) ou 2 (homologação)
 * @param {string} params.cUF - Código UF, exemplo: '35' para SP
 * @returns {string}
 */
function createStatusServicoXML({ tpAmb, cUF }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <cUF>${cUF}</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`;
}

/**
 * Consulta status do serviço NFe na SEFAZ
 * @param {Buffer} certificadoBuffer - Buffer do PFX
 * @param {string} senhaCertificado - Senha do certificado
 * @param {string} ambiente - 'producao' ou 'homologacao'
 * @param {string} cUF - Código da UF (ex: '35' para SP)
 * @returns {object} Resultado do status
 */
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
      sucesso: cStat === '107' || cStat === '108' || cStat === '109' || cStat === '111', // verifique os códigos de sucesso da SEFAZ
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

module.exports = {
  createAgentFromBuffer,
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  createStatusServicoXML,
  consultarStatusSefaz,     // <-- exportando nova função!
};
