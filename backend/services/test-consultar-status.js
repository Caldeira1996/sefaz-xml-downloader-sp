const fs = require('fs');
const path = require('path');
const { consultarStatusSefaz } = require('./sefaz'); // ajuste o caminho se necessário

(async () => {
  try {
    // Caminho para seu certificado PFX
    const pfxPath = path.join(__dirname, '../certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
    const pfxBuffer = fs.readFileSync(pfxPath);

    const senha = '123456'; // sua senha do certificado
    const ambiente = 'producao'; // ou 'homologacao'
    const cUF = '35'; // código da UF (São Paulo é 35)

    const resultado = await consultarStatusSefaz(pfxBuffer, senha, ambiente, cUF);

    console.log('Resultado da consulta de status SEFAZ:');
    console.log(JSON.stringify(resultado, null, 2));
  } catch (error) {
    console.error('Erro ao testar consultarStatusSefaz:', error);
  }
})();
