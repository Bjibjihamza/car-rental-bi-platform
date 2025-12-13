const express = require('express');
const router = express.Router();
const { getConnection } = require('../db');
const oracledb = require('oracledb');

// GET /api/v1/cars
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const { branchId } = req.query;
    
    let sql = `
      SELECT c.*, b.CITY as BRANCH_CITY 
      FROM CARS c
      LEFT JOIN BRANCHES b ON c.BRANCH_ID = b.BRANCH_ID
    `;
    const binds = {};
    
    if (branchId) {
      sql += ` WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = branchId;
    }
    
    sql += ` ORDER BY c.CREATED_AT DESC`;
    
    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// POST /api/v1/cars
router.post('/', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const {
      CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL,
      MODEL_YEAR, COLOR, IMAGE_URL, ODOMETER_KM, STATUS, BRANCH_ID
    } = req.body;

    // A. Insert Car
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
      catId: CATEGORY_ID,
      devId: DEVICE_ID || null,
      vin: VIN,
      plate: LICENSE_PLATE,
      make: MAKE,
      model: MODEL,
      year: MODEL_YEAR,
      color: COLOR,
      img: IMAGE_URL,
      odo: ODOMETER_KM,
      status: STATUS || 'AVAILABLE',
      branchId: BRANCH_ID,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };

    // Use autoCommit: false to handle transaction manually
    const r = await conn.execute(insertSql, binds, { autoCommit: false });
    const newCarId = r.outBinds.id[0];

    // B. Update Device Status if assigned
    if (DEVICE_ID) {
      await conn.execute(
        `UPDATE IOT_DEVICES SET STATUS = 'ACTIVE', BRANCH_ID = :bid WHERE DEVICE_ID = :did`,
        { bid: BRANCH_ID, did: DEVICE_ID },
        { autoCommit: false }
      );
    }

    await conn.commit(); // Commit both actions
    
    // Return the minimal data needed or fetch the full row if preferred
    res.status(201).json({ CAR_ID: newCarId, MAKE, MODEL, ...req.body });

  } catch (err) {
    try { await conn.rollback(); } catch {} // Rollback on error
    console.error(err);
    res.status(500).json({ message: "Failed to create car" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;