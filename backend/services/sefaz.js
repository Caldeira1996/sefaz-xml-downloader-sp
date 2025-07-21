const fs = require('fs');

const loadCertificate = (certificadoPath, senha) => {
  if (!fs.existsSync(certificadoPath)) {
    throw new Error('Arquivo de certificado não encontrado');
  }
  const certBuffer = fs.readFileSync(certificadoPath);
  return { pfx: certBuffer, passphrase: senha };
};

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

module.exports = {
  loadCertificate,
  createStatusEnvelope,
};
