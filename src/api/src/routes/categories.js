// src/api/src/routes/categories.js
const express = require("express");
const oracledb = require("oracledb");
const router = express.Router();

const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor } = require("../access");

// =====================================================
// GET /api/v1/categories
// =====================================================
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const r = await conn.execute(`
      SELECT CATEGORY_ID, CATEGORY_NAME, DESCRIPTION, CREATED_AT
      FROM CAR_CATEGORIES
      ORDER BY CATEGORY_NAME ASC
    `);

    return res.json(r.rows || []);
  } catch (err) {
    console.error("CATEGORIES_LIST_ERROR:", err);
    return res.status(500).json({ message: "Server Error" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// =====================================================
// POST /api/v1/categories (Supervisor only)
// =====================================================
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) {
    return res.status(403).json({ message: "Supervisor only" });
  }

  let conn;
  try {
    const { CATEGORY_NAME, DESCRIPTION } = req.body || {};
    if (!String(CATEGORY_NAME || "").trim()) {
      return res.status(400).json({ message: "CATEGORY_NAME is required" });
    }

    conn = await getConnection();

    const sql = `
      INSERT INTO CAR_CATEGORIES (CATEGORY_NAME, DESCRIPTION)
      VALUES (:name, :desc)
      RETURNING CATEGORY_ID INTO :id
    `;

    const r = await conn.execute(
      sql,
      {
        name: String(CATEGORY_NAME).trim(),
        desc: DESCRIPTION ? String(DESCRIPTION).trim() : "Added via Dashboard",
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      CATEGORY_ID: r.outBinds.id[0],
      CATEGORY_NAME: String(CATEGORY_NAME).trim(),
    });
  } catch (err) {
    console.error("CATEGORY_CREATE_ERROR:", err);

    if (String(err.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Category already exists" });
    }

    return res.status(500).json({ message: "Failed to create category" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
