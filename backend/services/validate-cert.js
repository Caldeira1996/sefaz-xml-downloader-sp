// validate-cert.js
const fs     = require('fs');
const https  = require('https');
const axios  = require('axios');
const path   = require('path');

async function validarCertificado(pfxPath, senhaCert) {
  try {
    /* ---------- agente HTTPS com certificado do cliente ---------- */
    const httpsAgent = new https.Agent({
      pfx: fs.readFileSync(pfxPath),
      passphrase: senhaCert,
      ca: fs.readFileSync(path.join(__dirname, '../certs/ca-chain.pem')),
      rejectUnauthorized: true,           // true em produção
    });

    /* ---------- envelope SOAP 1.2 ---------- */
    const xmlEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap12:Body>
    <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
      <xmlDadosMsg><![CDATA[
        <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>        <!-- 1 = produção | 2 = homologação -->
          <cUF>35</cUF>           <!-- 35 = São Paulo -->
          <xServ>STATUS</xServ>
        </consStatServ>
      ]]></xmlDadosMsg>
    </nfeStatusServicoNF>
  </soap12:Body>
</soap12:Envelope>`;

    /* ---------- cabeçalho SOAP 1.2 ---------- */
    const headers = {
      'Content-Type':
        'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF"',
    };

    /* ---------- chamada ----------- */
    const { data } = await axios.post(
      'https://nfe.fazenda.sp.gov.br/ws/NfeStatusServico4.asmx',
      xmlEnvelope,
      { httpsAgent, headers, timeout: 15000 }
    );

    return { valido: true, resposta: data };
  } catch (err) {
    if (err.response) {
      return {
        valido: false,
        status: err.response.status,
        data:   err.response.data,
        erro:   err.message,
      };
    }
    return { valido: false, erro: err.message };
  }
}

/* --------- executa teste --------- */
(async () => {
  const pfxPath  = path.join(__dirname, '../certificates',
    '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
  const senhaCert = '123456';

  const resultado = await validarCertificado(pfxPath, senhaCert);
  console.log(resultado);
})();
