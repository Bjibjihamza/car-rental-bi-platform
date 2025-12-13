// src/api/src/routes/customers.js
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
      SELECT c.CUSTOMER_ID, c.FIRST_NAME, c.LAST_NAME, c.EMAIL, c.PHONE, c.ID_NUMBER, c.CREATED_AT
      FROM CUSTOMERS c
    `;

    if (!isSupervisor(req)) {
      sql = `
        SELECT DISTINCT
          c.CUSTOMER_ID, c.FIRST_NAME, c.LAST_NAME, c.EMAIL, c.PHONE, c.ID_NUMBER, c.CREATED_AT
        FROM CUSTOMERS c
        JOIN RENTALS r ON r.CUSTOMER_ID = c.CUSTOMER_ID
        WHERE r.BRANCH_ID = :branchId
        ORDER BY c.CUSTOMER_ID DESC
      `;
      binds.branchId = requireBranch(req);
    } else {
      sql += ` ORDER BY c.CUSTOMER_ID DESC`;
    }

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: e.message || "Failed to fetch customers" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
