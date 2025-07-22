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

async function salvarCertificado(dados) {
  // Stub temporário só para teste
  return { id: 'teste-id', ...dados };
}

async function listarCertificadosAtivos() {
  // Stub temporário com dados fixos
  return [
    { id: '1', nome: 'Certificado Dummy', cnpj: '00.000.000/0000-00', ambiente: 'producao', ativo: true, is_principal: false, created_at: new Date().toISOString() },
  ];
}

async function buscarCertificado(certificadoId) {
  // Seu código já implementado
}

module.exports = {
  salvarCertificado,
  listarCertificadosAtivos,
  buscarCertificado,
};
