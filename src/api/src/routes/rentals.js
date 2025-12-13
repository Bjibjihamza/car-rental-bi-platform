// src/api/src/routes/rentals.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `
      SELECT
        r.RENTAL_ID,
        r.CAR_ID,
        r.CUSTOMER_ID,
        r.BRANCH_ID,
        r.MANAGER_ID,
        r.START_AT,
        r.DUE_AT,
        r.RETURN_AT,
        r.STATUS,
        r.TOTAL_AMOUNT,
        r.CURRENCY,
        r.CREATED_AT
      FROM RENTALS r
    `;

    if (!isSupervisor(req)) {
      sql += ` WHERE r.BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    sql += ` ORDER BY r.RENTAL_ID DESC`;

    const r1 = await conn.execute(sql, binds);
    res.json(r1.rows || []);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: e.message || "Failed to fetch rentals" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
