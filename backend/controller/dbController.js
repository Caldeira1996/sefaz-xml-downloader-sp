const { buscarCertificado } = require('../db/certificados');
const { salvarConsulta } = require('../db/consultas');
const { consultarNFe } = require('../services/sefaz');

async function consultar(req, res) {
  try {
    const { certificadoId, cnpjConsultado, tipoConsulta, ambiente } = req.body;
    const userId = req.user.id; // assumindo que você tem auth e user na requisição

    // Busca certificado no banco
    const { certificado_base64, senha_certificado } = await buscarCertificado(certificadoId, userId);

    const certificadoBuffer = Buffer.from(certificado_base64, 'base64');

    // Consulta SEFAZ
    const resultado = await consultarNFe({
      certificadoBuffer,
      senhaCertificado: senha_certificado,
      cnpjConsultado,
      tipoConsulta,
      ambiente,
    });

    // Salva consulta no banco
    await salvarConsulta({
      user_id: userId,
      certificado_id: certificadoId,
      cnpj_consultado: cnpjConsultado,
      tipo_consulta: tipoConsulta,
      status: 'sucesso',
      resultado,
      erro_mensagem: null,
      total_xmls: 0,
      xmls_baixados: 0,
    });

    res.json({ sucesso: true, resultado });
  } catch (error) {
    console.error('Erro na consulta SEFAZ:', error);
    res.status(500).json({ erro: error.message });
  }
}

module.exports = { consultar };
