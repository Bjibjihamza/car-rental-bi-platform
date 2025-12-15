// src/api/src/routes/customers.js
const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
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
      ORDER BY c.CUSTOMER_ID DESC
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

router.post("/", authMiddleware, async (req, res) => {
  const { FIRST_NAME, LAST_NAME, EMAIL, PHONE, ID_NUMBER } = req.body || {};

  if (!String(FIRST_NAME || "").trim())
    return res.status(400).json({ message: "FIRST_NAME is required" });
  if (!String(LAST_NAME || "").trim())
    return res.status(400).json({ message: "LAST_NAME is required" });

  let conn;
  try {
    conn = await getConnection();

    const sql = `
      INSERT INTO CUSTOMERS (FIRST_NAME, LAST_NAME, EMAIL, PHONE, ID_NUMBER)
      VALUES (:fn, :ln, :email, :phone, :idn)
      RETURNING CUSTOMER_ID INTO :id
    `;

    const binds = {
      fn: String(FIRST_NAME).trim(),
      ln: String(LAST_NAME).trim(),
      email: EMAIL ? String(EMAIL).trim() : null,
      phone: PHONE ? String(PHONE).trim() : null,
      idn: ID_NUMBER ? String(ID_NUMBER).trim() : null,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    return res.status(201).json({ CUSTOMER_ID: r.outBinds.id[0] });
  } catch (e) {
    console.error(e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Customer email already exists" });
    }
    return res.status(500).json({ message: e.message || "Failed to create customer" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid customer id" });

  let conn;
  try {
    conn = await getConnection();
    await conn.execute(`DELETE FROM CUSTOMERS WHERE CUSTOMER_ID = :id`, { id }, { autoCommit: true });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to delete customer" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
