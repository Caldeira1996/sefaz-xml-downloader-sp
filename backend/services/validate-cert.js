// validate-cert.js
const fs   = require('fs');
const https = require('https');
const axios = require('axios');
const path  = require('path');

async function validarCertificado(pfxPath, senha) {
  const httpsAgent = new https.Agent({
    pfx: fs.readFileSync(pfxPath),
    passphrase: senha,
    ca: fs.readFileSync(path.join(__dirname, '../certs/ca-chain.pem')),
    rejectUnauthorized: true,
  });

  /* -------- envelope aceito pela SEFAZ‑SP -------- */
  const xmlEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"
                 xmlns:ws="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
  <soap12:Header>
    <ws:nfeCabecMsg soap12:mustUnderstand="1">
      <cUF>35</cUF>
      <versaoDados>4.00</versaoDados>
    </ws:nfeCabecMsg>
  </soap12:Header>

  <soap12:Body>
    <ws:nfeStatusServicoNF>
      <ws:nfeDadosMsg><![CDATA[
        <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUF>35</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      ]]></ws:nfeDadosMsg>
    </ws:nfeStatusServicoNF>
  </soap12:Body>
</soap12:Envelope>`;

  const headers = {
    'Content-Type':
      'application/soap+xml; charset=utf-8; ' +
      'action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
  };

  try {
    const { data } = await axios.post(
      'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      xmlEnvelope,
      { httpsAgent, headers, timeout: 15000 }
    );
    return { valido: true, resposta: data };
  } catch (err) {
    return err.response
      ? { valido: false, status: err.response.status, data: err.response.data, erro: err.message }
      : { valido: false, erro: err.message };
  }
}

/* -------- teste -------- */
(async () => {
  const pfx = path.join(
    __dirname,
    '../certificates',
    '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx'
  );
  console.log(await validarCertificado(pfx, '123456'));
})();
