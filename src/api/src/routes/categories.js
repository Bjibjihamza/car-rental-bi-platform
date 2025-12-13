const express = require('express');
const router = express.Router();
const { getConnection } = require('../db');
const oracledb = require('oracledb');

// GET /api/v1/categories
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(`SELECT CATEGORY_ID, CATEGORY_NAME FROM CAR_CATEGORIES ORDER BY CATEGORY_NAME ASC`);
    res.json(r.rows || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// POST /api/v1/categories (Quick Add)
router.post('/', async (req, res) => {
  let conn;
  try {
    const { CATEGORY_NAME } = req.body;
    if (!CATEGORY_NAME) return res.status(400).json({ message: "Name required" });

    conn = await getConnection();
    const sql = `
      INSERT INTO CAR_CATEGORIES (CATEGORY_NAME, DESCRIPTION)
      VALUES (:name, 'Added via Dashboard')
      RETURNING CATEGORY_ID INTO :id
    `;
    
    const r = await conn.execute(
      sql, 
      { 
        name: CATEGORY_NAME, 
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } 
      }, 
      { autoCommit: true }
    );
    
    res.status(201).json({ CATEGORY_ID: r.outBinds.id[0], CATEGORY_NAME });
  } catch (err) {
    if (err.message && err.message.includes('ORA-00001')) {
       return res.status(409).json({ message: "Category already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create category" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;