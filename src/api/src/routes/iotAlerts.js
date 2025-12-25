// src/api/src/routes/iotAlerts.js
// ✅ FULL FILE — compatible with SILVER_LAYER.IOT_ALERTS (TITLE + DESCRIPTION + SEVERITY)
// ✅ No MESSAGE column (it does NOT exist in your silver.sql)

const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

/**
 * GET /api/v1/iot-alerts
 * - Supervisor: all alerts
 * - Manager: only alerts in his branch
 * - Uses SILVER schema columns: TITLE, DESCRIPTION, SEVERITY, STATUS, CREATED_AT
 */
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `
      SELECT
        a.ALERT_ID,
        a.CAR_ID,
        a.BRANCH_ID,
        b.CITY AS BRANCH_CITY,
        a.DEVICE_ID,
        a.RENTAL_ID,
        a.ALERT_TYPE,
        a.SEVERITY,
        a.TITLE,
        a.DESCRIPTION,
        a.STATUS,
        a.EVENT_TS,
        a.CREATED_AT,
        a.RESOLVED_AT
      FROM IOT_ALERTS a
      LEFT JOIN BRANCHES b ON b.BRANCH_ID = a.BRANCH_ID
    `;

    if (!isSupervisor(req)) {
      sql += ` WHERE a.BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    }

    sql += ` ORDER BY a.CREATED_AT DESC FETCH FIRST 500 ROWS ONLY`;

    const r = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    // Shape response for frontend
    const rows = (r.rows || []).map((x) => {
      const status = String(x.STATUS || "OPEN").toUpperCase();
      const severity = String(x.SEVERITY || "LOW").toUpperCase();

      return {
        ALERT_ID: x.ALERT_ID,
        CAR_ID: x.CAR_ID,
        BRANCH_ID: x.BRANCH_ID,
        BRANCH_CITY: x.BRANCH_CITY || "Unknown",
        DEVICE_ID: x.DEVICE_ID ?? null,
        RENTAL_ID: x.RENTAL_ID ?? null,

        ALERT_TYPE: x.ALERT_TYPE,
        STATUS: status,
        SEVERITY: severity,

        // ✅ front-friendly
        TITLE: x.TITLE || "Vehicle anomaly detected",
        MESSAGE: x.DESCRIPTION || x.TITLE || "System Alert",

        EVENT_TS: x.EVENT_TS,
        CREATED_AT: x.CREATED_AT,
        RESOLVED_AT: x.RESOLVED_AT,
      };
    });

    return res.json(rows);
  } catch (e) {
    console.error("IOT_ALERTS_GET_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed to fetch alerts" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

/**
 * PATCH /api/v1/iot-alerts/:id/resolve
 * - Supervisor: can resolve any
 * - Manager: can resolve only within his branch
 * - Updates STATUS + RESOLVED_AT
 */
router.patch("/:id/resolve", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid alert id" });

    const binds = { id };
    let sql = `
      UPDATE IOT_ALERTS
         SET STATUS = 'RESOLVED',
             RESOLVED_AT = SYSTIMESTAMP
       WHERE ALERT_ID = :id
         AND STATUS = 'OPEN'
    `;

    if (!isSupervisor(req)) {
      sql += ` AND BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    }

    const r = await conn.execute(sql, binds, { autoCommit: true });
    if ((r.rowsAffected || 0) === 0) {
      return res.status(404).json({ message: "Alert not found (or already resolved)" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("ALERT_RESOLVE_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed to resolve alert" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

/**
 * GET /api/v1/iot-alerts/unresolved-count
 * - Supervisor: counts all OPEN
 * - Manager: counts OPEN in his branch
 */
router.get("/unresolved-count", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `SELECT COUNT(*) AS CNT FROM IOT_ALERTS WHERE STATUS='OPEN'`;

    if (!isSupervisor(req)) {
      sql += ` AND BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    }

    const r = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const cnt = r.rows?.[0]?.CNT ?? 0;

    return res.json({ count: Number(cnt) });
  } catch (e) {
    console.error("ALERT_COUNT_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed to fetch alert count" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
