// services/certificados.js
const supabaseClient = require('./supabase'); // ajuste conforme seu caminho real

async function buscarCertificado(certificadoId, user) {
  const { data: certificado, error: certError } = await supabaseClient
    .from('certificados')
    .select('*')
    .eq('id', certificadoId)
    .eq('user_id', user.id)
    .single();

  if (certError || !certificado) {
    throw new Error('Certificado não encontrado ou não autorizado');
  }
  return certificado;
}

module.exports = { buscarCertificado };
