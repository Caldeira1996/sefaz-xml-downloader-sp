// ──────────────────────────────────────────────────────────────
// services/certificados.js
// ──────────────────────────────────────────────────────────────
const pool = require('../db'); // ajuste se o caminho do seu pool for outro

/* Salva um novo certificado */
async function salvarCertificado({
  nome,
  cnpj,
  certificado_base64,
  senha_certificado,
  ambiente = 'producao',
  validade = null,
  tipo = 'A1'
}) {
  const query = `
    INSERT INTO certificados
      (nome, cnpj, validade, tipo, certificado_base64, senha, ambiente, criado_em)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    RETURNING id, nome, cnpj, validade, tipo, ambiente, criado_em;
  `;
  const { rows } = await pool.query(query, [
    nome, cnpj, validade, tipo, certificado_base64, senha_certificado, ambiente
  ]);
  return rows[0];
}

/* Lista todos os certificados válidos/ativos */
async function listarCertificadosAtivos() {
  const { rows } = await pool.query(`
    SELECT id, nome, cnpj, validade, tipo, ambiente,
           criado_em, is_principal
      FROM certificados
      WHERE validade IS NULL OR validade > NOW()
      ORDER BY criado_em DESC;
  `);
  return rows;
}

/* 🔹 NOVO: busca um certificado específico pelo ID */
async function buscarCertificado(id) {
  const { rows } = await pool.query(`
    SELECT id, nome, cnpj, validade, tipo, ambiente,
           certificado_base64, senha
      FROM certificados
     WHERE id = $1
  `, [id]);

  if (!rows.length) return null;

  const c = rows[0];
  return {
    id: c.id,
    nome: c.nome,
    cnpj: c.cnpj,
    validade: c.validade,
    tipo: c.tipo,
    ambiente: c.ambiente,
    certificado_base64: c.certificado_base64,
    senha_certificado: c.senha,
  };
}

/* Mantido: busca o “principal” (o mais recente) */
async function buscarCertificadoPrincipal() {
  const { rows } = await pool.query(`
    SELECT id, nome, cnpj, validade, tipo, ambiente,
           certificado_base64, senha
      FROM certificados
     WHERE validade IS NULL OR validade > NOW()
  ORDER BY criado_em DESC
     LIMIT 1
  `);
  if (!rows.length) throw new Error('Nenhum certificado principal encontrado');

  const c = rows[0];
  return {
    id: c.id,
    nome: c.nome,
    cnpj: c.cnpj,
    validade: c.validade,
    tipo: c.tipo,
    ambiente: c.ambiente,
    certificado_base64: c.certificado_base64,
    senha_certificado: c.senha,
  };
}

/* Remove certificado */
async function excluirCertificado(id) {
  await pool.query('DELETE FROM certificados WHERE id = $1', [id]);
}

async function marcarComoPrincipal(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // pega o CNPJ correspondente
    const {
      rows: [{ cnpj }],
    } = await client.query('SELECT cnpj FROM certificados WHERE id = $1', [id]);
    if (!cnpj) throw new Error('Certificado não encontrado');

    // limpa os principais desse CNPJ
    await client.query(
      'UPDATE certificados SET is_principal = FALSE WHERE cnpj = $1',
      [cnpj]
    );

    // define o escolhido
    await client.query(
      'UPDATE certificados SET is_principal = TRUE, ambiente = ambiente -- mantém, só exemplo\n' +
      'WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


module.exports = {
  salvarCertificado,
  listarCertificadosAtivos,
  buscarCertificado,            // ← exportado
  buscarCertificadoPrincipal,
  excluirCertificado,
  marcarComoPrincipal,
};
