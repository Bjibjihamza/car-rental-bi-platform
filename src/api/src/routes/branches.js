const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

// 1. LIST BRANCHES
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

// 2. CREATE BRANCH (Supervisor Only)
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const { BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL } = req.body || {};

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
    res.json({ BRANCH_ID: r.outBinds.id[0], message: "Branch created" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to create branch" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 3. EDIT BRANCH (Supervisor Only)
router.put("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const branchId = req.params.id;
  const { BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL } = req.body || {};

  if (!String(BRANCH_NAME || "").trim()) return res.status(400).json({ message: "BRANCH_NAME is required" });
  if (!String(CITY || "").trim()) return res.status(400).json({ message: "CITY is required" });

  let conn;
  try {
    conn = await getConnection();
    const sql = `
      UPDATE BRANCHES 
      SET BRANCH_NAME = :name,
          CITY = :city,
          ADDRESS = :addr,
          PHONE = :phone,
          EMAIL = :email
      WHERE BRANCH_ID = :id
    `;
    const binds = {
      id: branchId,
      name: String(BRANCH_NAME).trim(),
      city: String(CITY).trim(),
      addr: ADDRESS ? String(ADDRESS).trim() : null,
      phone: PHONE ? String(PHONE).trim() : null,
      email: EMAIL ? String(EMAIL).trim() : null,
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    
    if (r.rowsAffected === 0) return res.status(404).json({ message: "Branch not found" });
    
    res.json({ message: "Branch updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to update branch" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 4. DELETE BRANCH (Supervisor Only)
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const branchId = req.params.id;
  let conn;
  try {
    conn = await getConnection();
    
    // Note: This will fail if there are FK constraints (Rentals, Cars, Managers linked to this branch)
    // You must delete or reassign those resources first, or use ON DELETE CASCADE in DB.
    const sql = `DELETE FROM BRANCHES WHERE BRANCH_ID = :id`;
    
    const r = await conn.execute(sql, { id: branchId }, { autoCommit: true });
    
    if (r.rowsAffected === 0) return res.status(404).json({ message: "Branch not found" });

    res.json({ message: "Branch deleted" });
  } catch (e) {
    console.error(e);
    // Oracle error for constraint violation is usually ORA-02292
    if (e.message && e.message.includes("ORA-02292")) {
       return res.status(400).json({ message: "Cannot delete branch: It has active cars, managers, or rentals." });
    }
    res.status(500).json({ message: e.message || "Failed to delete branch" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;