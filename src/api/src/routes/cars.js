// src/routes/cars.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");

router.get("/", authMiddleware, async (req, res) => {
  const user = req.user;
  const isSupervisor = user.role === "supervisor";

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

module.exports = router;
