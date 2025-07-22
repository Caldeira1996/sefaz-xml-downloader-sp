async function buscarCertificado(certificadoId) {
  const query = `
    SELECT certificado_base64, senha_certificado FROM certificados
    WHERE id = $1
  `;
  const { rows } = await pool.query(query, [certificadoId]);
  if (rows.length === 0) {
    throw new Error('Certificado não encontrado');
  }
  return {
    certificadoBuffer: Buffer.from(rows[0].certificado_base64, 'base64'),
    senhaCertificado: rows[0].senha_certificado,
  };
}
