const supabaseClient = require('../supabase'); // ajuste o caminho conforme seu projeto

/**
 * Busca o certificado no banco pelo id e usuário autenticado.
 * Retorna o buffer do arquivo PFX decodificado de base64.
 * @param {string} certificadoId - ID do certificado no banco
 * @param {object} user - usuário autenticado (objeto com .id)
 * @returns {Buffer} buffer do certificado PFX
 */
async function buscarCertificado(certificadoId, user) {
  const { data: certificado, error } = await supabaseClient
    .from('certificados')
    .select('pfx_base64') // nome do campo que guarda o certificado em base64
    .eq('id', certificadoId)
    .eq('user_id', user.id)
    .single();

  if (error || !certificado) {
    throw new Error('Certificado não encontrado ou não autorizado');
  }

  // Converte o base64 para buffer
  const bufferPfx = Buffer.from(certificado.pfx_base64, 'base64');
  return bufferPfx;
}

module.exports = { buscarCertificado };
