const pool = require('./index');

async function salvarCertificado(certificado) {
  const query = `
    INSERT INTO certificados (user_id, nome, cnpj, certificado_base64, senha_certificado, ambiente, ativo, is_principal)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  const values = [
    certificado.user_id,
    certificado.nome,
    certificado.cnpj,
    certificado.certificado_base64,
    certificado.senha_certificado,
    certificado.ambiente || null,
    certificado.ativo !== undefined ? certificado.ativo : true,
    certificado.is_principal || false,
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
}

async function buscarCertificado(certificadoId, userId) {
  const query = `SELECT certificado_base64, senha_certificado FROM certificados WHERE id = $1 AND user_id = $2`;
  const { rows } = await pool.query(query, [certificadoId, userId]);
  if (rows.length === 0) {
    throw new Error('Certificado não encontrado ou não autorizado');
  }
  return {
    certificado_base64: rows[0].certificado_base64,
    senha_certificado: rows[0].senha_certificado,
  };
}

module.exports = { salvarCertificado, buscarCertificado };
