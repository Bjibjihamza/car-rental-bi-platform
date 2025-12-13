const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor } = require("../access");
const oracledb = require("oracledb");

// 1. GET AVAILABLE DEVICES (For Dropdowns)
router.get('/available', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const query = `
      SELECT DEVICE_ID, DEVICE_CODE, STATUS 
      FROM IOT_DEVICES 
      WHERE STATUS = 'INACTIVE' 
      AND DEVICE_ID NOT IN (SELECT DEVICE_ID FROM CARS WHERE DEVICE_ID IS NOT NULL)
    `;
    const r = await conn.execute(query);
    res.json(r.rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 2. LIST ALL DEVICES (Main Page)
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    
    // SMART QUERY:
    // 1. Join Device to Car (to see if it's installed)
    // 2. Join Car to Branch (to see where the car is)
    // 3. Join Device to Branch (fallback if not in a car)
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
        
        -- Car Assignment Info
        c.CAR_ID,
        c.LICENSE_PLATE,
        c.MAKE,
        c.MODEL,

        -- Location Logic: Use Car's Branch if assigned, otherwise Device's Branch
        COALESCE(b_car.BRANCH_ID, b_dev.BRANCH_ID) as ACTUAL_BRANCH_ID,
        COALESCE(b_car.BRANCH_NAME, b_dev.BRANCH_NAME) as BRANCH_NAME,
        COALESCE(b_car.CITY, b_dev.CITY) as BRANCH_CITY,
        
        -- Flag to know source of location
        CASE WHEN c.CAR_ID IS NOT NULL THEN 1 ELSE 0 END as IS_INSTALLED

      FROM IOT_DEVICES d
      LEFT JOIN CARS c ON d.DEVICE_ID = c.DEVICE_ID
      LEFT JOIN BRANCHES b_car ON c.BRANCH_ID = b_car.BRANCH_ID  -- Branch via Car
      LEFT JOIN BRANCHES b_dev ON d.BRANCH_ID = b_dev.BRANCH_ID  -- Branch via Device
      ORDER BY d.DEVICE_ID DESC
    `;
    
    const r = await conn.execute(sql);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to fetch devices" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 3. CREATE DEVICE
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const { DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID } = req.body || {};
  if (!String(DEVICE_CODE || "").trim()) return res.status(400).json({ message: "Device Code is required" });

  let conn;
  try {
    conn = await getConnection();
    const sql = `
      INSERT INTO IOT_DEVICES (DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID)
      VALUES (:code, :imei, :fw, :status, :branchId)
      RETURNING DEVICE_ID INTO :id
    `;
    const binds = {
      code: String(DEVICE_CODE).trim(),
      imei: DEVICE_IMEI ? String(DEVICE_IMEI).trim() : null,
      fw: FIRMWARE_VERSION ? String(FIRMWARE_VERSION).trim() : null,
      status: STATUS || 'INACTIVE',
      branchId: BRANCH_ID ? Number(BRANCH_ID) : null,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    res.json({ DEVICE_ID: r.outBinds.id[0], message: "Device registered" });
  } catch (e) {
    console.error(e);
    if (e.message && e.message.includes("ORA-00001")) return res.status(409).json({ message: "Device Code or IMEI already exists" });
    res.status(500).json({ message: "Failed to create device" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 4. EDIT DEVICE
router.put("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const deviceId = req.params.id;
  const { DEVICE_CODE, DEVICE_IMEI, FIRMWARE_VERSION, STATUS, BRANCH_ID } = req.body || {};

  let conn;
  try {
    conn = await getConnection();
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
      code: String(DEVICE_CODE).trim(),
      imei: DEVICE_IMEI || null,
      fw: FIRMWARE_VERSION || null,
      status: STATUS || 'INACTIVE',
      branchId: BRANCH_ID ? Number(BRANCH_ID) : null
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    if (r.rowsAffected === 0) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to update device" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 5. DELETE DEVICE
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(`DELETE FROM IOT_DEVICES WHERE DEVICE_ID = :id`, { id: req.params.id }, { autoCommit: true });
    if (r.rowsAffected === 0) return res.status(404).json({ message: "Device not found" });
    res.json({ message: "Device deleted" });
  } catch (e) {
    if (e.message && e.message.includes("ORA-02292")) return res.status(400).json({ message: "Cannot delete: Device linked to car." });
    res.status(500).json({ message: "Failed to delete" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;