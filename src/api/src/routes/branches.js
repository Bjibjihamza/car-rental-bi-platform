// src/api/src/routes/branches.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    let sql = `
      SELECT BRANCH_ID, BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL, CREATED_AT
      FROM BRANCHES
    `;
    const binds = {};

    if (!isSupervisor(req)) {
      sql += ` WHERE BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    sql += ` ORDER BY CITY, BRANCH_NAME`;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: e.message || "Failed" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// Supervisor only: create branch
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const {
    BRANCH_NAME,
    CITY,
    ADDRESS = null,
    PHONE = null,
    EMAIL = null,
  } = req.body || {};

  if (!String(BRANCH_NAME || "").trim()) return res.status(400).json({ message: "BRANCH_NAME is required" });
  if (!String(CITY || "").trim()) return res.status(400).json({ message: "CITY is required" });

  let conn;
  try {
    conn = await getConnection();

    const oracledb = require("oracledb");
    const sql = `
      INSERT INTO BRANCHES (BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL)
      VALUES (:name, :city, :addr, :phone, :email)
      RETURNING BRANCH_ID INTO :id
    `;
    const binds = {
      name: String(BRANCH_NAME).trim(),
      city: String(CITY).trim(),
      addr: ADDRESS ? String(ADDRESS).trim() : null,
      phone: PHONE ? String(PHONE).trim() : null,
      email: EMAIL ? String(EMAIL).trim() : null,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    res.json({ BRANCH_ID: r.outBinds.id[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to create branch" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
