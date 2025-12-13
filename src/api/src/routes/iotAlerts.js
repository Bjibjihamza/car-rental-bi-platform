// src/api/src/routes/iotAlerts.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `SELECT ALERT_ID, BRANCH_ID, STATUS, CREATED_AT FROM IOT_ALERTS`;

    if (!isSupervisor(req)) {
      sql += ` WHERE BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    sql += ` ORDER BY ALERT_ID DESC`;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: e.message || "Failed to fetch alerts" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
