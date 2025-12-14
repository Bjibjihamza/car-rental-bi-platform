// ✅ src/api/src/routes/devices.js
const express = require("express");
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

const router = express.Router();

/* ===============================
   LIST DEVICES (Supervisor: all | Manager: own branch)
   (keeps your extra fields: assignment + branch name/city + installed)
================================ */
router.get("/", authMiddleware, async (req, res) => {
  const sup = isSupervisor(req);
  const branchId = sup ? null : requireBranch(req);

  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let where = "";
    if (!sup) {
      where = `WHERE NVL(d.BRANCH_ID, -1) = :branchId`;
      binds.branchId = Number(branchId);
    }

    const sql = `
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
        c.LICENSE_PLATE,
        c.MAKE,
        c.MODEL,

        NVL(c.BRANCH_ID, d.BRANCH_ID) AS ACTUAL_BRANCH_ID,
        b.BRANCH_NAME,
        b.CITY AS BRANCH_CITY,
        CASE WHEN c.CAR_ID IS NULL THEN 0 ELSE 1 END AS IS_INSTALLED
      FROM IOT_DEVICES d
      LEFT JOIN CARS c ON c.DEVICE_ID = d.DEVICE_ID
      LEFT JOIN BRANCHES b ON b.BRANCH_ID = NVL(c.BRANCH_ID, d.BRANCH_ID)
      ${where}
      ORDER BY d.DEVICE_ID DESC
    `;

    const r = await conn.execute(sql, binds);
    return res.json(r.rows || []);
  } catch (e) {
    console.error("DEVICES_GET_ERROR:", e);
    return res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

/* ===============================
   CREATE DEVICE
   - Supervisor: can set any BRANCH_ID (or null)
   - Manager: forced to his branch (cannot create for another)
================================ */
router.post("/", authMiddleware, async (req, res) => {
  const sup = isSupervisor(req);
  const userBranchId = sup ? null : requireBranch(req);

  const { DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID } = req.body || {};

  if (!DEVICE_CODE) return res.status(400).json({ message: "DEVICE_CODE is required" });

  const status = String(STATUS || "INACTIVE").toUpperCase();
  if (!["ACTIVE", "INACTIVE", "RETIRED"].includes(status)) {
    return res.status(400).json({ message: "Invalid STATUS" });
  }

  const branchIdToUse = sup
    ? (BRANCH_ID ? Number(BRANCH_ID) : null)
    : Number(userBranchId);

  let conn;
  try {
    conn = await getConnection();

    const sql = `
      INSERT INTO IOT_DEVICES (
        DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID, CREATED_AT
      )
      VALUES (
        :code, :imei, :fw, :status, :branchId, SYSTIMESTAMP
      )
      RETURNING DEVICE_ID INTO :id
    `;

    const binds = {
      code: String(DEVICE_CODE).trim(),
      imei: DEVICE_IMEI ? String(DEVICE_IMEI).trim() : null,
      fw: FIRMWARE_VERSION ? String(FIRMWARE_VERSION).trim() : null,
      status,
      branchId: branchIdToUse,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ DEVICE_ID: r.outBinds.id[0], message: "Device created" });
  } catch (e) {
    console.error("DEVICES_POST_ERROR:", e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Device code or IMEI already exists" });
    }
    return res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});


// GET /api/v1/devices/available
// Supervisor: all unassigned devices (optionally filter by branchId)
// Manager: only unassigned devices in his branch
router.get("/available", authMiddleware, async (req, res) => {
  const sup = isSupervisor(req);
  const userBranchId = sup ? null : requireBranch(req);

  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let where = `
      WHERE d.STATUS <> 'RETIRED'
        AND NOT EXISTS (SELECT 1 FROM CARS c WHERE c.DEVICE_ID = d.DEVICE_ID)
    `;

    // manager forced branch
    if (!sup) {
      where += ` AND NVL(d.BRANCH_ID, -1) = :bid`;
      binds.bid = Number(userBranchId);
    } else if (req.query.branchId) {
      where += ` AND NVL(d.BRANCH_ID, -1) = :bid`;
      binds.bid = Number(req.query.branchId);
    }

    const sql = `
      SELECT d.DEVICE_ID, d.DEVICE_CODE
      FROM IOT_DEVICES d
      ${where}
      ORDER BY d.DEVICE_CODE
    `;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error("DEVICES_AVAILABLE_ERROR:", e);
    res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});


/* ===============================
   UPDATE DEVICE
   - Supervisor: can update anything + move branch
   - Manager: can update but cannot change BRANCH_ID (forced to own)
================================ */
router.put("/:id", authMiddleware, async (req, res) => {
  const sup = isSupervisor(req);
  const userBranchId = sup ? null : requireBranch(req);

  const deviceId = Number(req.params.id);
  const { DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID } = req.body || {};

  const status = String(STATUS || "INACTIVE").toUpperCase();
  if (!["ACTIVE", "INACTIVE", "RETIRED"].includes(status)) {
    return res.status(400).json({ message: "Invalid STATUS" });
  }

  const branchIdToUse = sup
    ? (BRANCH_ID ? Number(BRANCH_ID) : null)
    : Number(userBranchId);

  let conn;
  try {
    conn = await getConnection();

    // Manager can only edit devices in his branch
    if (!sup) {
      const chk = await conn.execute(
        `SELECT 1 FROM IOT_DEVICES WHERE DEVICE_ID = :id AND NVL(BRANCH_ID, -1) = :branchId`,
        { id: deviceId, branchId: Number(userBranchId) }
      );
      if ((chk.rows || []).length === 0) {
        return res.status(403).json({ message: "Forbidden: not in your branch" });
      }
    }

    const sql = `
      UPDATE IOT_DEVICES
      SET DEVICE_CODE = :code,
          DEVICE_IMEI = :imei,
          FIRMWARE_VERSION = :fw,
          STATUS = :status,
          BRANCH_ID = :branchId
      WHERE DEVICE_ID = :id
    `;

    const binds = {
      id: deviceId,
      code: String(DEVICE_CODE || "").trim(),
      imei: DEVICE_IMEI ? String(DEVICE_IMEI).trim() : null,
      fw: FIRMWARE_VERSION ? String(FIRMWARE_VERSION).trim() : null,
      status,
      branchId: branchIdToUse,
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    if (r.rowsAffected === 0) return res.status(404).json({ message: "Device not found" });

    return res.json({ message: "Device updated" });
  } catch (e) {
    console.error("DEVICES_PUT_ERROR:", e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Device code or IMEI already exists" });
    }
    return res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

/* ===============================
   DELETE DEVICE (Supervisor only)
================================ */
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const deviceId = Number(req.params.id);
  let conn;
  try {
    conn = await getConnection();

    const chk = await conn.execute(
      `SELECT 1 FROM CARS WHERE DEVICE_ID = :id`,
      { id: deviceId }
    );
    if ((chk.rows || []).length > 0) {
      return res.status(400).json({ message: "Cannot delete: device is assigned to a car" });
    }

    const r = await conn.execute(
      `DELETE FROM IOT_DEVICES WHERE DEVICE_ID = :id`,
      { id: deviceId },
      { autoCommit: true }
    );

    if (r.rowsAffected === 0) return res.status(404).json({ message: "Device not found" });
    return res.json({ message: "Device deleted" });
  } catch (e) {
    console.error("DEVICES_DELETE_ERROR:", e);
    return res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
