const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

// GET /api/v1/cars
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const sup = isSupervisor(req);
    const binds = {};
    let where = "";

    // Supervisor: can see all, optional branch filter
    // Manager: forced to his own branch
    if (!sup) {
      where = `WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    } else if (req.query.branchId) {
      where = `WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = Number(req.query.branchId);
    }

    const sql = `
      SELECT c.*, b.CITY as BRANCH_CITY
      FROM CARS c
      LEFT JOIN BRANCHES b ON c.BRANCH_ID = b.BRANCH_ID
      ${where}
      ORDER BY c.CREATED_AT DESC
    `;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server Error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// POST /api/v1/cars
router.post("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const sup = isSupervisor(req);
    const userBranchId = sup ? null : requireBranch(req);

    const {
      CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL,
      MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS, BRANCH_ID
    } = req.body || {};

    // 🔒 Manager cannot choose another branch
    const branchIdToUse = sup ? Number(BRANCH_ID) : Number(userBranchId);

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
      vin: VIN,
      plate: LICENSE_PLATE,
      make: MAKE,
      model: MODEL,
      year: Number(MODEL_YEAR),
      color: COLOR,
      img: IMAGE_URL || null,
      odo: Number(ODOMETER_KM || 0),
      status: STATUS || "AVAILABLE",
      branchId: branchIdToUse,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const r = await conn.execute(insertSql, binds, { autoCommit: false });
    const newCarId = r.outBinds.id[0];

    if (DEVICE_ID) {
      // optional: verify device belongs to same branch for manager
      if (!sup) {
        const chk = await conn.execute(
          `SELECT 1 FROM IOT_DEVICES
           WHERE DEVICE_ID = :did AND NVL(BRANCH_ID,-1) = :bid`,
          { did: Number(DEVICE_ID), bid: Number(branchIdToUse) }
        );
        if ((chk.rows || []).length === 0) {
          await conn.rollback();
          return res.status(403).json({ message: "Device not in your branch" });
        }
      }

      await conn.execute(
        `UPDATE IOT_DEVICES SET STATUS='ACTIVE', BRANCH_ID=:bid WHERE DEVICE_ID=:did`,
        { bid: Number(branchIdToUse), did: Number(DEVICE_ID) },
        { autoCommit: false }
      );
    }

    await conn.commit();
    res.status(201).json({ CAR_ID: newCarId, ...req.body, BRANCH_ID: branchIdToUse });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error(e);
    res.status(500).json({ message: "Failed to create car" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
