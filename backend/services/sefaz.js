// services/sefaz.js

const soap = require('soap');
const fs = require('fs');
const path = require('path');
const { getCertificado } = require('./certificados');

async function consultarXml(certificadoNome, xml) {
  const certData = getCertificado(certificadoNome);

  if (!certData) {
    throw new Error('Certificado não encontrado');
  }

  // Exemplo de chamada SOAP — você precisa adaptar ao WSDL correto da SEFAZ
  const url = 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsulta2.asmx?wsdl';

  const options = {
    wsdl_options: {
      pfx: certData.pfx,
      passphrase: certData.password,
      rejectUnauthorized: false
    }
  };

  const client = await soap.createClientAsync(url, options);

  const args = {
    nfeDadosMsg: {
      // XML já assinado
      _xml: xml
    }
  };

  const result = await client.nfeConsultaNF2Async(args);

  return result;
}

module.exports = {
  consultarXml
};
