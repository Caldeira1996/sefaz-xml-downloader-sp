// test-consultar-status.js
const fs   = require('fs');
const path = require('path');
const { consultarStatusSefaz } = require('./sefaz'); // ajuste o caminho se necessário

(async () => {
  try {
    // Lê o PFX diretamente
    const pfxPath = path.join(__dirname, 'certificates', '52.055.075 VANUZIA BARBOSA DE JESUS_52055075000173.pfx');
    const pfxBuffer = fs.readFileSync(pfxPath);

    const senha    = '123456';  // senha do PFX
    const ambiente = 'producao'; // ou 'homologacao'
    const cUF      = '35';       // SP

    const resultado = await consultarStatusSefaz(pfxBuffer, senha, ambiente, cUF);

    console.log('Resultado da consulta de status SEFAZ:');
    console.log(JSON.stringify(resultado, null, 2));
  } catch (error) {
    console.error('❌ Erro ao testar consultarStatusSefaz:', error);
  }
})();
