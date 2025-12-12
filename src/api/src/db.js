// src/db.js
const oracledb = require("oracledb");
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

async function initPool() {
  if (pool) return pool;

  const {
    ORACLE_HOST,
    ORACLE_PORT,
    ORACLE_SERVICE,
    ORACLE_USER,
    ORACLE_PASSWORD,
  } = process.env;

  const connectString = `${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}`;

  pool = await oracledb.createPool({
    user: ORACLE_USER,
    password: ORACLE_PASSWORD,
    connectString,
    poolMin: 1,
    poolMax: 10,
    poolIncrement: 1,
  });

  console.log("✅ Oracle pool created:", connectString);

  // safe sanity check
  const conn = await pool.getConnection();
  const r = await conn.execute(
    "SELECT sys_context('USERENV','CON_NAME') AS CON_NAME FROM dual"
  );
  console.log("✅ Oracle connected. CON_NAME =", r.rows[0].CON_NAME);
  await conn.close();

  return pool;
}

async function getConnection() {
  if (!pool) await initPool();
  return pool.getConnection();
}

module.exports = { initPool, getConnection };
