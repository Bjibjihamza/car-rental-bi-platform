// src/api/src/db.js
const oracledb = require("oracledb");
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

async function initPool() {
  if (pool) return pool;

  const host = process.env.ORACLE_HOST;
  const port = process.env.ORACLE_PORT || "1521";
  const service = process.env.ORACLE_SERVICE || "XEPDB1";

  pool = await oracledb.createPool({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: `${host}:${port}/${service}`,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1,
  });

  return pool;
}

async function getConnection() {
  await initPool();
  return pool.getConnection();
}

module.exports = { initPool, getConnection };
