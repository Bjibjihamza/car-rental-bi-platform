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

module.exports = router;
