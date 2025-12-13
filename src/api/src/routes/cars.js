// src/api/src/routes/cars.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");

function isSupervisorUser(user) {
  return String(user?.role || "").toLowerCase() === "supervisor";
}

router.get("/", authMiddleware, async (req, res) => {
  const user = req.user;
  const isSupervisor = isSupervisorUser(user);

  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `
      SELECT
        c.CAR_ID,
        c.CATEGORY_ID,
        c.DEVICE_ID,
        c.VIN,
        c.LICENSE_PLATE,
        c.MAKE,
        c.MODEL,
        c.MODEL_YEAR,
        c.COLOR,
        c.IMAGE_URL,
        c.ODOMETER_KM,
        c.STATUS,
        c.BRANCH_ID,
        c.CREATED_AT,
        b.CITY AS BRANCH_CITY
      FROM CARS c
      LEFT JOIN BRANCHES b ON b.BRANCH_ID = c.BRANCH_ID
    `;

    if (!isSupervisor) {
      sql += ` WHERE c.BRANCH_ID = :branchId `;
      binds.branchId = user.branchId;
    }

    sql += ` ORDER BY c.CAR_ID DESC`;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch cars" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

/**
 * POST /api/v1/cars
 * Supervisor only
 * Body: { CATEGORY_ID, DEVICE_ID?, VIN, LICENSE_PLATE, MAKE, MODEL, MODEL_YEAR, COLOR, IMAGE_URL?, ODOMETER_KM, STATUS, BRANCH_ID }
 */
router.post("/", authMiddleware, async (req, res) => {
  const user = req.user;
  const isSupervisor = isSupervisorUser(user);
  if (!isSupervisor) return res.status(403).json({ message: "Supervisor only" });

  const b = req.body || {};

  // basic validations
  const required = ["CATEGORY_ID", "VIN", "LICENSE_PLATE", "MAKE", "MODEL", "BRANCH_ID"];
  for (const k of required) {
    if (b[k] === undefined || b[k] === null || String(b[k]).trim() === "") {
      return res.status(400).json({ message: `Missing field: ${k}` });
    }
  }

  const payload = {
    CATEGORY_ID: Number(b.CATEGORY_ID),
    DEVICE_ID: b.DEVICE_ID === null || b.DEVICE_ID === "" ? null : Number(b.DEVICE_ID),
    VIN: String(b.VIN).trim(),
    LICENSE_PLATE: String(b.LICENSE_PLATE).trim(),
    MAKE: String(b.MAKE).trim(),
    MODEL: String(b.MODEL).trim(),
    MODEL_YEAR: b.MODEL_YEAR ? Number(b.MODEL_YEAR) : null,
    COLOR: b.COLOR ? String(b.COLOR).trim() : null,
    IMAGE_URL: b.IMAGE_URL ? String(b.IMAGE_URL).trim() : null,
    ODOMETER_KM: b.ODOMETER_KM ? Number(b.ODOMETER_KM) : 0,
    STATUS: b.STATUS ? String(b.STATUS).trim().toUpperCase() : "AVAILABLE",
    BRANCH_ID: Number(b.BRANCH_ID),
  };

  let conn;
  try {
    conn = await getConnection();

    // ✅ If device selected: ensure it's available (not already used by another car)
    if (payload.DEVICE_ID) {
      const check = await conn.execute(
        `SELECT 1 AS X FROM CARS WHERE DEVICE_ID = :deviceId`,
        { deviceId: payload.DEVICE_ID }
      );
      if ((check.rows || []).length > 0) {
        return res.status(409).json({ message: "Device already assigned to another car" });
      }
    }

    const sql = `
      INSERT INTO CARS (
        CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE,
        MAKE, MODEL, MODEL_YEAR, COLOR, IMAGE_URL,
        ODOMETER_KM, STATUS, BRANCH_ID
      ) VALUES (
        :CATEGORY_ID, :DEVICE_ID, :VIN, :LICENSE_PLATE,
        :MAKE, :MODEL, :MODEL_YEAR, :COLOR, :IMAGE_URL,
        :ODOMETER_KM, :STATUS, :BRANCH_ID
      )
      RETURNING CAR_ID INTO :OUT_CAR_ID
    `;

    const binds = {
      ...payload,
      OUT_CAR_ID: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    const newId = r.outBinds?.OUT_CAR_ID?.[0];

    res.status(201).json({ CAR_ID: newId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to create car" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
