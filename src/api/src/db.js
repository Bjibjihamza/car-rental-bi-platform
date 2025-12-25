// src/api/src/db.js
const oracledb = require("oracledb");

// ✅ return rows as objects: row.MANAGER_ID etc.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Pools
let silverPool;
let goldPool;

function connectString() {
  const host = process.env.ORACLE_HOST;
  const port = process.env.ORACLE_PORT || "1521";
  const service = process.env.ORACLE_SERVICE || "XEPDB1";
  return `${host}:${port}/${service}`;
}

async function initSilverPool() {
  if (silverPool) return silverPool;

  const user = process.env.ORACLE_USER; // SILVER user
  const password = process.env.ORACLE_PASSWORD;

  if (!user || !password) {
    throw new Error("Missing ORACLE_USER / ORACLE_PASSWORD for SILVER connection");
  }

  silverPool = await oracledb.createPool({
    user,
    password,
    connectString: connectString(),
    poolMin: 1,
    poolMax: 8,
    poolIncrement: 1,
  });

  return silverPool;
}

async function initGoldPool() {
  // GOLD is optional: only init if env provided
  if (goldPool) return goldPool;

  const user = process.env.ORACLE_GOLD_USER;
  const password = process.env.ORACLE_GOLD_PASSWORD;

  if (!user || !password) {
    // Not configured => no gold pool
    return null;
  }

  goldPool = await oracledb.createPool({
    user,
    password,
    connectString: connectString(),
    poolMin: 1,
    poolMax: 4,
    poolIncrement: 1,
  });

  return goldPool;
}

async function initPool() {
  // Keep compatibility: init default (silver) pool
  await initSilverPool();
  // Init gold if configured
  await initGoldPool();
}

// ✅ default connection = SILVER (CRUD)
async function getConnection() {
  await initSilverPool();
  return silverPool.getConnection();
}

// ✅ explicit SILVER
async function getSilverConnection() {
  await initSilverPool();
  return silverPool.getConnection();
}

// ✅ explicit GOLD (analytics)
async function getGoldConnection() {
  const p = await initGoldPool();
  if (!p) {
    const err = new Error("GOLD pool is not configured (ORACLE_GOLD_USER/PASSWORD missing)");
    err.status = 500;
    throw err;
  }
  return p.getConnection();
}

// ✅ graceful shutdown (important in Docker)
async function closePools() {
  try {
    if (goldPool) {
      await goldPool.close(10);
      goldPool = null;
    }
  } catch (e) {
    console.error("❌ Error closing GOLD pool:", e);
  }

  try {
    if (silverPool) {
      await silverPool.close(10);
      silverPool = null;
    }
  } catch (e) {
    console.error("❌ Error closing SILVER pool:", e);
  }
}

process.on("SIGINT", async () => {
  await closePools();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closePools();
  process.exit(0);
});

module.exports = {
  initPool,
  getConnection, 
  getSilverConnection,
  getGoldConnection,
  closePools,
};
