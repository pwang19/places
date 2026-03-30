// importing and destructuring Pool from pg;
const { Pool } = require("pg");
 
// using Pool to connect with our Postgres DB;
// Support both DATABASE_URL (for ElephantSQL) and individual PG variables
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL.includes('amazonaws.com') || process.env.DATABASE_URL.includes('elephantsql.com') 
                ? { rejectUnauthorized: false } 
                : false
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