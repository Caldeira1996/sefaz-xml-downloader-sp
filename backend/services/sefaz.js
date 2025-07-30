require('dotenv').config();
const axios             = require('axios');
const { createMtlsAgent } = require('../lib/tlsConfig');

// services/sefaz.js
const URL_STATUS_PROD = 'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';
const URL_STATUS_HOMO = 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx';

/**
 * Consulta “Status do Serviço” (cStat 107) da SEFAZ‑SP.
 * @param {string} certificadoFilename  Caminho para o .pfx
 * @param {string} senhaCertificado     Senha do .pfx
 * @param {'producao'|'homolog'} ambiente
 */
async function consultarStatusSefaz({ certificadoFilename, senhaCertificado, ambiente = 'producao' }) {
  const httpsAgent = createMtlsAgent(certificadoFilename, senhaCertificado);

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
  <soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
      <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
        <nfeDadosMsg><![CDATA[
          <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
            <tpAmb>${ambiente === 'producao' ? 1 : 2}</tpAmb>
            <cUF>35</cUF>
            <xServ>STATUS</xServ>
          </consStatServ>
        ]]></nfeDadosMsg>
      </nfeStatusServicoNF>
    </soap12:Body>
  </soap12:Envelope>`;

  const url = ambiente === 'producao' ? URL_STATUS_PROD : URL_STATUS_HOMO;
  const { data } = await axios.post(url, envelope, {
    httpsAgent,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction':
        '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
    },
  });

  return data;           // devolve XML de resposta
}

// ⬇️  não esqueça de adicionar ao export
module.exports = {
  createDistDFeIntXML,
  consultarDistribuicaoDFe,
  consultarStatusSefaz,     // <-- novo
};
