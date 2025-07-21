const { Pool } = require('pg');

const pool = new Pool({
  user: 'lucas_user',
  host: 'localhost',
  database: 'sefaz_db',
  password: '123456',
  port: 5432,
});

module.exports = pool;
