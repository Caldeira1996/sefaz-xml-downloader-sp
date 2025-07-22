const axios = require('axios');
const https = require('https');

/**
 * Cria um agente HTTPS a partir do buffer do certificado PFX e senha.
 * @param {Buffer} bufferPfx - Buffer do arquivo PFX
 * @param {string} senha - senha do certificado
 * @returns {https.Agent}
 */
function createAgentFromBuffer(bufferPfx, senha) {
  return new https.Agent({
    pfx: bufferPfx,
    passphrase: senha,
    rejectUnauthorized: true,
  });
}

/**
 * Gera o XML base de consulta da Distribuição DFe
 * @param {object} params
 * @param {number} params.tpAmb - Ambiente (1=produção, 2=homologação)
 * @param {string} params.cUFAutor - Código UF, exemplo '35' para SP
 * @param {string} params.CNPJ - CNPJ da empresa consultante (sem formatação)
 * @param {string} params.distNSU - NSU inicial (40 zeros para consultar tudo)
 * @returns {string} XML para ser assinado
 */
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>${distNSU}</distNSU>
</distDFeInt>`;
}

/**
 * Envia o XML assinado no envelope SOAP para o serviço NFeDistribuicaoDFe
 * @param {Buffer} certificadoBuffer - Buffer do PFX
 * @param {string} senhaCertificado - Senha do certificado
 * @param {string} xmlAssinado - XML da consulta já assinado (com assinatura XML)
 * @param {string} ambiente - 'producao' ou 'homologacao'
 */
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

module.exports = {
  createAgentFromBuffer,
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
};
