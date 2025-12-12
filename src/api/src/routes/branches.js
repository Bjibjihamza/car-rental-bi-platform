const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const sql = `
      SELECT BRANCH_ID AS branch_id, BRANCH_NAME AS branch_name, CITY AS city
      FROM BRANCHES
      ORDER BY CITY
    `;
    const r = await conn.execute(sql);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Internal server error" });
  } finally {
    if (conn) await conn.close();
  }
});


// GET /api/v1/branches/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid branch id" });

  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `SELECT BRANCH_ID, BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL
       FROM BRANCHES
       WHERE BRANCH_ID = :id`,
      { id }
    );
    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ message: "Branch not found" });
    return res.json(row);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});


module.exports = router;
