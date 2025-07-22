const pool = require('../db'); // ajuste para o seu pool de conexão

// Salvar novo certificado no banco
async function salvarCertificado({
  nome,
  cnpj,
  certificado_base64,
  senha_certificado,
  ambiente = 'producao',
  validade = null,
  tipo = 'A1'
}) {
  // Aqui você pode ajustar como obter a validade real do certificado, se quiser
  const query = `
    INSERT INTO certificados (nome, cnpj, validade, tipo, certificado_base64, senha, criado_em)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id, nome, cnpj, validade, tipo, ambiente, criado_em;
  `;
  const values = [
    nome,
    cnpj,
    validade,
    tipo,
    certificado_base64,
    senha_certificado
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

// Listar todos os certificados ativos (validade no futuro)
async function listarCertificadosAtivos() {
  const query = `
    SELECT id, nome, cnpj, validade, tipo, criado_em
    FROM certificados
    WHERE validade IS NULL OR validade > NOW()
    ORDER BY criado_em DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
}

// Buscar certificado pelo ID
// Buscar o certificado principal (o primeiro, por enquanto)
async function buscarCertificadoPrincipal() {
  const query = `
    SELECT id, nome, cnpj, validade, tipo, certificado_base64, senha
    FROM certificados
    WHERE validade IS NULL OR validade > NOW()
    ORDER BY criado_em DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(query);
  if (!rows.length) {
    throw new Error('Nenhum certificado principal encontrado');
  }
  return {
    id: rows[0].id,
    nome: rows[0].nome,
    cnpj: rows[0].cnpj,
    validade: rows[0].validade,
    tipo: rows[0].tipo,
    certificado_base64: rows[0].certificado_base64,
    senha_certificado: rows[0].senha,
  };
}

module.exports = {
  salvarCertificado,
  listarCertificadosAtivos,
  buscarCertificadoPrincipal,  // <-- NÃO ESQUEÇA DE EXPORTAR!
};