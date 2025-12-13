// src/api/src/routes/managers.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");

router.get("/", authMiddleware, async (req, res) => {
  if (req.user?.role !== "supervisor") return res.status(403).json({ message: "Forbidden" });

  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(`
      SELECT MANAGER_ID, MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ROLE, BRANCH_ID, HIRE_DATE
      FROM MANAGERS
      ORDER BY MANAGER_ID DESC
    `);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch managers" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
