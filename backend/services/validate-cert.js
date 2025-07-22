// validate-cert.js  — versão enxuta, sem espaços extras
const fs    = require('fs');
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

  // envelope TODO em UMA LINHA
  const xmlEnvelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
      '<soap12:Body>' +
        '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">' +
          '<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">' +
            '<tpAmb>1</tpAmb>' +
            '<cUF>35</cUF>' +
            '<xServ>STATUS</xServ>' +
          '</consStatServ>' +
        '</nfeDadosMsg>' +
      '</soap12:Body>' +
    '</soap12:Envelope>';

  const headers = {
    'Content-Type':
      'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
  };

  const { data } = await axios.post(
    'https://nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
    xmlEnvelope,
    { httpsAgent, headers, timeout: 15000 }
  );

  console.log(data);
}

/* teste */
(async () => {
  const pfx = path.join(
    __dirname,
    '../certificates',
    '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx'
  );
  await validarCertificado(pfx, '123456');
})();
