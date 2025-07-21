// services/certificado.js
const pool = require('../db');

async function buscarCertificado(certificadoId, user) {
  const query = `
    SELECT certificado_base64, senha_certificado FROM certificados
    WHERE id = $1 AND user_id = $2
  `;
  const { rows } = await pool.query(query, [certificadoId, user.id]);
  if (rows.length === 0) {
    throw new Error('Certificado não encontrado ou não autorizado');
  }
  return {
    certificadoBuffer: Buffer.from(rows[0].certificado_base64, 'base64'),
    senhaCertificado: rows[0].senha_certificado,
  };
}

module.exports = { buscarCertificado };
