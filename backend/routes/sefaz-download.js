// backend/routes/sefaz-download.js

const express = require('express');
const router = express.Router();
const { buscarCertificadoPrincipal } = require('../services/certificados'); // Adapte para sua função
const { Buffer } = require('buffer');
const axios = require('axios');
const https = require('https');

// Monta XML do DistDFe
function createDistDFeIntXML({ tpAmb, cUFAutor, CNPJ, distNSU }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${tpAmb}</tpAmb>
  <cUFAutor>${cUFAutor}</cUFAutor>
  <CNPJ>${CNPJ}</CNPJ>
  <distNSU>${distNSU}</distNSU>
</distDFeInt>`;
}

router.post('/download-xml', async (req, res) => {
  try {
    // Parâmetros do frontend
    const { cnpj, ambiente, nsu } = req.body;
    if (!cnpj) return res.status(400).json({ success: false, error: 'CNPJ não informado' });

    // 1. Busca certificado PFX e senha do banco
    const cert = await buscarCertificadoPrincipal();
    if (!cert || !cert.certificado_base64 || !cert.senha_certificado) {
      return res.status(400).json({ success: false, error: 'Certificado não encontrado' });
    }

    // 2. Monta buffer PFX
    const certificadoBuffer = Buffer.from(cert.certificado_base64, 'base64');

    // 3. Monta XML da consulta
    const tpAmb = ambiente === 'homologacao' ? '2' : '1';
    const xml = createDistDFeIntXML({
      tpAmb,
      cUFAutor: '35',    // 35 = SP
      CNPJ: cnpj,
      distNSU: nsu || '000000000000000'
    });

    // 4. Monta Envelope SOAP
    const envelopeSoap = `
<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"
                  xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
  <soapenv:Header/>
  <soapenv:Body>
    <nfe:nfeDadosMsg><![CDATA[
      ${xml}
    ]]></nfe:nfeDadosMsg>
  </soapenv:Body>
</soapenv:Envelope>`;

    // 5. Cria https.Agent usando o certificado
    const httpsAgent = new https.Agent({
      pfx: certificadoBuffer,
      passphrase: cert.senha_certificado,
      rejectUnauthorized: true,
      // Se precisar adicionar cadeia, descomente:
      // ca: fs.readFileSync('caminho/chain.pem')
    });

    // 6. Endpoint correto para distribuição NF-e
    const url = ambiente === 'homologacao'
      ? 'https://homologacao.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
      : 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

    // 7. Envia requisição
    const response = await axios.post(url, envelopeSoap, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
      },
      timeout: 15000,
    });

    // 8. Extrai XML da resposta (vem como string)
    const xmlRetorno = response.data;

    // Aqui você pode usar regex para pegar o XML dos documentos, ou retornar tudo para o front:
    return res.json({
      success: true,
      xml: xmlRetorno
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      detalhes: error.response?.data || null
    });
  }
});

module.exports = router;
