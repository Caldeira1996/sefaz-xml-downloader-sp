const { buscarCertificado } = require('../services/certificados');
const { consultarNFe } = require('../services/sefaz');

/**
 * Controller para rota POST /api/sefaz/consulta
 * Espera receber:
 * - certificadoId: ID do certificado salvo no banco
 * - senhaCertificado: senha do certificado
 * - cnpjConsultado: CNPJ alvo da consulta (pode ser opcional ou usado em outros envelopes)
 * - ambiente: 'producao' ou 'homologacao'
 * O usuário autenticado deve estar disponível em req.user (middleware de autenticação).
 */
exports.consulta = async (req, res) => {
  try {
    const { certificadoId, senhaCertificado, cnpjConsultado, ambiente } = req.body;
    const user = req.user; // middleware de autenticação deve preencher req.user

    if (!certificadoId || !senhaCertificado || !ambiente) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios faltando' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Busca o buffer do certificado no banco
    const certificadoBuffer = await buscarCertificado(certificadoId, user);

    // Consulta a SEFAZ
    const resultado = await consultarNFe({
      certificadoBuffer,
      senhaCertificado,
      cnpjConsultado,
      ambiente,
      tipoConsulta: 'status', // ajuste conforme sua lógica
    });

    res.json({ sucesso: true, resultado });
  } catch (err) {
    console.error('[Erro /api/sefaz/consulta]:', err);
    res.status(500).json({ error: 'Erro interno ao consultar a SEFAZ' });
  }
};
