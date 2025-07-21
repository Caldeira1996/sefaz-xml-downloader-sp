const fs = require('fs');
const axios = require('axios');
const https = require('https');

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
async function consultarNFe({ certificado, cnpjConsultado, tipoConsulta, ambiente, dataInicio, dataFim }) {
  // Aqui você deve montar o envelope SOAP conforme tipoConsulta
  // Vou deixar um exemplo simplificado de status, você precisa adaptar para sua consulta

  if (!certificado || !certificado.certificado_base64 || !certificado.senha_certificado) {
    throw new Error('Certificado inválido');
  }

  // Decodifica o certificado base64 para Buffer
  const pfxBuffer = Buffer.from(certificado.certificado_base64, 'base64');

  // Configura o HTTPS Agent com certificado e senha
  const httpsAgent = new https.Agent({
    pfx: pfxBuffer,
    passphrase: certificado.senha_certificado,
    rejectUnauthorized: false, // para homologação, em produção recomenda true
  });

  // Monta a URL do Web Service conforme ambiente (exemplo SP)
  const url = ambiente === 'producao'
    ? 'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx' // URL produção
    : 'https://homologacao.nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx'; // URL homologação

  // Exemplo envelope - status serviço
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

    // Retorna o corpo da resposta (XML)
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
