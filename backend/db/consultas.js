const pool = require('./index');

async function salvarConsulta(consulta) {
  const query = `
    INSERT INTO consultas_sefaz (user_id, certificado_id, cnpj_consultado, tipo_consulta, status, resultado, erro_mensagem, total_xmls, xmls_baixados)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;

  const values = [
    consulta.user_id,
    consulta.certificado_id,
    consulta.cnpj_consultado,
    consulta.tipo_consulta,
    consulta.status || null,
    consulta.resultado || null,
    consulta.erro_mensagem || null,
    consulta.total_xmls || 0,
    consulta.xmls_baixados || 0,
  ];

  const res = await pool.query(query, values);
  return res.rows[0];
}

module.exports = { salvarConsulta };
