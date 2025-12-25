// src/api/src/routes/cars.js
const express = require("express");
const oracledb = require("oracledb");
const router = express.Router();

const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

// =====================================================
// GET /api/v1/cars
// Supervisor: all, optional branchId filter
// Manager: forced to his branch
// =====================================================
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const sup = isSupervisor(req);
    const binds = {};
    let where = "";

    if (!sup) {
      where = `WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    } else if (req.query.branchId) {
      where = `WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = Number(req.query.branchId);
    }

    const sql = `
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
      ${where}
      ORDER BY c.CREATED_AT DESC
    `;

    const r = await conn.execute(sql, binds);
    return res.json(r.rows || []);
  } catch (e) {
    console.error("CARS_LIST_ERROR:", e);
    return res.status(500).json({ message: "Server Error" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// =====================================================
// POST /api/v1/cars
// Supervisor: can choose BRANCH_ID
// Manager: forced to his branch
// =====================================================
router.post("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const sup = isSupervisor(req);
    const userBranchId = sup ? null : Number(requireBranch(req));

    const {
      CATEGORY_ID,
      DEVICE_ID,
      VIN,
      LICENSE_PLATE,
      MAKE,
      MODEL,
      MODEL_YEAR,
      COLOR,
      IMAGE_URL,
      ODOMETER_KM,
      STATUS,
      BRANCH_ID,
    } = req.body || {};

    // minimal validation
    if (!CATEGORY_ID) return res.status(400).json({ message: "CATEGORY_ID is required" });
    if (!String(VIN || "").trim()) return res.status(400).json({ message: "VIN is required" });
    if (!String(LICENSE_PLATE || "").trim()) return res.status(400).json({ message: "LICENSE_PLATE is required" });
    if (!String(MAKE || "").trim()) return res.status(400).json({ message: "MAKE is required" });
    if (!String(MODEL || "").trim()) return res.status(400).json({ message: "MODEL is required" });

    const branchIdToUse = sup ? Number(BRANCH_ID) : userBranchId;
    if (!branchIdToUse) return res.status(400).json({ message: "BRANCH_ID is required" });

    const insertSql = `
      INSERT INTO CARS (
        CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL,
        MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS, BRANCH_ID
      ) VALUES (
        :catId, :devId, :vin, :plate, :make, :model,
        :year, :color, :img, :odo, :status, :branchId
      )
      RETURNING CAR_ID INTO :id
    `;

    const binds = {
      catId: Number(CATEGORY_ID),
      devId: DEVICE_ID ? Number(DEVICE_ID) : null,
      vin: String(VIN).trim(),
      plate: String(LICENSE_PLATE).trim(),
      make: String(MAKE).trim(),
      model: String(MODEL).trim(),
      year: MODEL_YEAR ? Number(MODEL_YEAR) : null,
      color: COLOR ? String(COLOR).trim() : null,
      img: IMAGE_URL ? String(IMAGE_URL).trim() : null,
      odo: Number(ODOMETER_KM || 0),
      status: STATUS ? String(STATUS).trim() : "AVAILABLE",
      branchId: Number(branchIdToUse),
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    // transaction: insert car + maybe update device
    const r = await conn.execute(insertSql, binds, { autoCommit: false });
    const newCarId = r.outBinds.id[0];

    if (DEVICE_ID) {
      const did = Number(DEVICE_ID);

      // Manager cannot attach device outside his branch
      if (!sup) {
        const chk = await conn.execute(
          `
          SELECT 1
          FROM IOT_DEVICES
          WHERE DEVICE_ID = :did
            AND NVL(BRANCH_ID, -1) = :bid
          `,
          { did, bid: Number(branchIdToUse) }
        );

        if ((chk.rows || []).length === 0) {
          await conn.rollback();
          return res.status(403).json({ message: "Device not in your branch" });
        }
      }

      // Activate device + bind it to branch
      await conn.execute(
        `
        UPDATE IOT_DEVICES
           SET STATUS='ACTIVE',
               BRANCH_ID=:bid,
               ACTIVATED_AT = NVL(ACTIVATED_AT, SYSTIMESTAMP)
         WHERE DEVICE_ID=:did
        `,
        { bid: Number(branchIdToUse), did },
        { autoCommit: false }
      );
    }

    await conn.commit();

    return res.status(201).json({
      CAR_ID: newCarId,
      ...req.body,
      BRANCH_ID: branchIdToUse,
    });
  } catch (e) {
    try {
      if (conn) await conn.rollback();
    } catch {}

    console.error("CAR_CREATE_ERROR:", e);

    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Duplicate data (VIN / LICENSE_PLATE / DEVICE_ID must be unique)" });
    }

    return res.status(500).json({ message: "Failed to create car" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
