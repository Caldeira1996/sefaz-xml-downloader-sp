const fs = require('fs');
const axios = require('axios');
const https = require('https');
const path = require('path');

// função utilitária para criar https.Agent
function createAgentFromPfx(nomeCertificado, senha) {
  const certPath = path.join(__dirname, 'certificates', `${nomeCertificado}.pfx`);
  if (!fs.existsSync(certPath)) throw new Error('Certificado não encontrado');
  const pfxBuffer = fs.readFileSync(certPath);
  return new https.Agent({ pfx: pfxBuffer, passphrase: senha, rejectUnauthorized: false });
}

/**
 * Carrega o certificado PFX do caminho informado
 * @param {string} certificadoPath - caminho do arquivo .pfx
 * @param {string} senha - senha do certificado
 * @returns {Object} objeto com pfx (Buffer) e passphrase (string)
 */
const loadCertificate = (certificadoPath, senha) => {
  if (!fs.existsSync(certificadoPath)) {
    throw new Error('Arquivo de certificado não encontrado');
  }
  const certBuffer = fs.readFileSync(certificadoPath);
  return { pfx: certBuffer, passphrase: senha };
};

/**
 * Cria o envelope SOAP para consultar status do serviço (exemplo)
 */
const createStatusEnvelope = () => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <nfeDadosMsg>
        <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <tpAmb>2</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfeDadosMsg>
    </nfeStatusServicoNF>
  </soap:Body>
</soap:Envelope>`;

/**
 * Função genérica para consultar a SEFAZ via SOAP
 * @param {Object} params
 * @param {Object} params.certificado - Objeto com propriedades: certificado_base64 (string base64), senha_certificado (string)
 * @param {string} params.cnpjConsultado
 * @param {string} params.tipoConsulta - exemplo: 'manifestacao', 'status', etc (a ser implementado)
 * @param {string} params.ambiente - 'producao' ou 'homologacao'
 * @param {string} [params.dataInicio]
 * @param {string} [params.dataFim]
 * @returns {Promise<any>} resposta da SEFAZ
 */
async function consultarNFe({ certificadoPath, senhaCertificado, cnpjConsultado, tipoConsulta, ambiente }) {
  // certificadoPath aqui pode ser só o nome do arquivo (sem ".pfx") ou o caminho completo.
  // Se for o nome, a função já monta o caminho dentro da pasta 'certificates'.
  const httpsAgent = createAgentFromPfx(certificadoPath, senhaCertificado);

  const url = ambiente === 'producao'
    ? 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx'
    : 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx';

  const xmlEnvelope = createStatusEnvelope();

  try {
    const response = await axios.post(url, xmlEnvelope, {
      httpsAgent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    console.error('Erro na consulta SEFAZ:', error);
    throw error;
  }
}



module.exports = {
  loadCertificate,
  createStatusEnvelope,
  consultarNFe,
};
