// src/api/src/routes/devices.js
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
    let sql = `
      SELECT
        d.DEVICE_ID,
        d.DEVICE_CODE,
        d.DEVICE_IMEI,
        d.FIRMWARE_VERSION,
        d.STATUS,
        d.ACTIVATED_AT,
        d.LAST_SEEN_AT,
        d.CREATED_AT,
        c.CAR_ID,
        c.BRANCH_ID
      FROM IOT_DEVICES d
      LEFT JOIN CARS c ON c.DEVICE_ID = d.DEVICE_ID
    `;

    if (!isSupervisor(req)) {
      sql += ` WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    sql += ` ORDER BY d.DEVICE_ID DESC`;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: e.message || "Failed to fetch devices" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
