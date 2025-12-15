// src/api/src/routes/iotAlerts.js
const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    // ✅ FIX: Added a.MESSAGE and a.SEVERITY (if it exists in DB) to the SELECT list
    let sql = `
      SELECT 
        a.ALERT_ID,
        a.BRANCH_ID,
        b.CITY AS BRANCH_CITY,
        a.STATUS,
        a.MESSAGE, 
        a.SEVERITY,
        a.CREATED_AT
      FROM IOT_ALERTS a
      LEFT JOIN BRANCHES b ON b.BRANCH_ID = a.BRANCH_ID
    `;

    if (!isSupervisor(req)) {
      sql += ` WHERE a.BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    sql += ` ORDER BY a.CREATED_AT DESC FETCH FIRST 500 ROWS ONLY`;

    const r = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    const rows = (r.rows || []).map((x) => {
      const status = String(x.STATUS || "OPEN").toUpperCase();
      
      // Use DB severity if available, otherwise calculate it
      let severity = x.SEVERITY || "LOW";
      if (!x.SEVERITY) {
          const ageMin = x.CREATED_AT ? (Date.now() - new Date(x.CREATED_AT).getTime()) / 60000 : 0;
          severity = status === "OPEN" && ageMin > 30 ? "HIGH" : status === "OPEN" ? "MEDIUM" : "LOW";
      }

      return {
        ALERT_ID: x.ALERT_ID,
        BRANCH_ID: x.BRANCH_ID,
        BRANCH_CITY: x.BRANCH_CITY || "Unknown",
        STATUS: status,
        SEVERITY: severity,
        MESSAGE: x.MESSAGE || "System Alert", // Ensure MESSAGE is passed
        TITLE: status === "OPEN" ? "Vehicle anomaly detected" : "Resolved incident",
        CREATED_AT: x.CREATED_AT,
      };
    });

    res.json(rows);
  } catch (e) {
    // ... existing error handling
    console.error(e);
    res.status(500).json({message: "Error"});
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});
// PATCH /api/v1/iot-alerts/:id/resolve
router.patch("/:id/resolve", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  let conn;
  try {
    conn = await getConnection();

    // branch-scope safety
    const binds = { id };
    let sql = `UPDATE IOT_ALERTS SET STATUS='RESOLVED' WHERE ALERT_ID=:id`;
    if (!isSupervisor(req)) {
      sql += ` AND BRANCH_ID=:branchId`;
      binds.branchId = requireBranch(req);
    }

    const r = await conn.execute(sql, binds, { autoCommit: true });
    if (r.rowsAffected === 0) return res.status(404).json({ message: "Alert not found" });

    res.json({ ok: true });
  } catch (e) {
    console.error("ALERT_RESOLVE_ERROR:", e);
    res.status(500).json({ message: e.message || "Failed to resolve alert" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// GET /api/v1/iot-alerts/unresolved-count
router.get("/unresolved-count", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `SELECT COUNT(*) AS CNT FROM IOT_ALERTS WHERE STATUS='OPEN'`;
    if (!isSupervisor(req)) {
      sql += ` AND BRANCH_ID=:branchId`;
      binds.branchId = requireBranch(req);
    }

    const r = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const cnt = r.rows?.[0]?.CNT ?? 0;
    res.json({ count: Number(cnt) });
  } catch (e) {
    console.error("ALERT_COUNT_ERROR:", e);
    res.status(500).json({ message: "Failed to fetch alert count" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
