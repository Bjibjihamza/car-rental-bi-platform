// src/api/src/routes/devices.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

/**
 * GET /api/v1/devices
 * - Supervisor: all devices
 * - Manager: devices assigned to cars in their branch
 */
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

/**
 * GET /api/v1/devices/available
 * devices not assigned to any car
 * - Supervisor: returns list
 * - Manager: returns []
 */
router.get("/available", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.json([]);

  let conn;
  try {
    conn = await getConnection();

    const sql = `
      SELECT
        d.DEVICE_ID,
        d.DEVICE_CODE,
        d.DEVICE_IMEI,
        d.FIRMWARE_VERSION,
        d.STATUS,
        d.ACTIVATED_AT,
        d.LAST_SEEN_AT,
        d.CREATED_AT
      FROM IOT_DEVICES d
      LEFT JOIN CARS c ON c.DEVICE_ID = d.DEVICE_ID
      WHERE c.CAR_ID IS NULL
      ORDER BY d.DEVICE_ID DESC
    `;

    const r = await conn.execute(sql, {});
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to fetch available devices" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

/**
 * POST /api/v1/devices
 * Supervisor only
 */
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) {
    return res.status(403).json({ message: "Supervisor only" });
  }

  const {
    DEVICE_CODE,
    DEVICE_IMEI = null,
    FIRMWARE_VERSION = null,
    STATUS = "INACTIVE",
  } = req.body || {};

  if (!String(DEVICE_CODE || "").trim()) {
    return res.status(400).json({ message: "DEVICE_CODE is required" });
  }

  const allowed = ["ACTIVE", "INACTIVE", "RETIRED"];
  const st = String(STATUS || "INACTIVE").toUpperCase();
  if (!allowed.includes(st)) {
    return res.status(400).json({ message: "Invalid STATUS" });
  }

  let conn;
  try {
    conn = await getConnection();

    const sql = `
      INSERT INTO IOT_DEVICES (
        DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, ACTIVATED_AT
      ) VALUES (
        :code, :imei, :fw, :status,
        CASE WHEN :status = 'ACTIVE' THEN SYSTIMESTAMP ELSE NULL END
      )
      RETURNING DEVICE_ID INTO :id
    `;

    const binds = {
      code: String(DEVICE_CODE).trim(),
      imei: DEVICE_IMEI ? String(DEVICE_IMEI).trim() : null,
      fw: FIRMWARE_VERSION ? String(FIRMWARE_VERSION).trim() : null,
      status: st,
      id: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    res.json({ DEVICE_ID: r.outBinds.id[0] });
  } catch (e) {
    console.error(e);

    // unique constraint errors (vin/plate/code/imei style)
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "DEVICE_CODE or DEVICE_IMEI already exists" });
    }

    res.status(500).json({ message: e.message || "Failed to create device" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
