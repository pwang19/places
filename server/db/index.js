const { Pool } = require("pg");

function poolSslFromUrl(url) {
  if (!url) return false;
  return url.includes("amazonaws.com") || url.includes("elephantsql.com")
    ? { rejectUnauthorized: false }
    : false;
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: poolSslFromUrl(process.env.DATABASE_URL),
      }
    : {
        user: process.env.PGUSER,
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT,
      }
);

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};