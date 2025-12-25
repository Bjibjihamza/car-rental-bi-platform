// src/api/src/routes/branches.js
const express = require("express");
const oracledb = require("oracledb");
const router = express.Router();

const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

// =====================================================
// 1) LIST BRANCHES
// Supervisor: all
// Manager: only his branch
// =====================================================
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    let sql = `
      SELECT
        BRANCH_ID, BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL, CREATED_AT
      FROM BRANCHES
    `;
    const binds = {};

    if (!isSupervisor(req)) {
      sql += ` WHERE BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    }

    sql += ` ORDER BY CITY, BRANCH_NAME`;

    const r = await conn.execute(sql, binds);
    return res.json(r.rows || []);
  } catch (e) {
    console.error("BRANCHES_LIST_ERROR:", e);
    return res.status(e.status || 500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// =====================================================
// 2) CREATE BRANCH (Supervisor only)
// =====================================================
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) {
    return res.status(403).json({ message: "Supervisor only" });
  }

  const { BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL } = req.body || {};

  if (!String(BRANCH_NAME || "").trim()) {
    return res.status(400).json({ message: "BRANCH_NAME is required" });
  }
  if (!String(CITY || "").trim()) {
    return res.status(400).json({ message: "CITY is required" });
  }

  let conn;
  try {
    conn = await getConnection();

    const sql = `
      INSERT INTO BRANCHES (BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL)
      VALUES (:name, :city, :addr, :phone, :email)
      RETURNING BRANCH_ID INTO :id
    `;

    const r = await conn.execute(
      sql,
      {
        name: String(BRANCH_NAME).trim(),
        city: String(CITY).trim(),
        addr: ADDRESS ? String(ADDRESS).trim() : null,
        phone: PHONE ? String(PHONE).trim() : null,
        email: EMAIL ? String(EMAIL).trim() : null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      BRANCH_ID: r.outBinds.id[0],
      message: "Branch created",
    });
  } catch (e) {
    console.error("BRANCH_CREATE_ERROR:", e);

    // ORA-00001 unique constraint
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Duplicate branch data (unique constraint)" });
    }

    return res.status(500).json({ message: e.message || "Failed to create branch" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// =====================================================
// 3) UPDATE BRANCH (Supervisor only)
// =====================================================
router.put("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) {
    return res.status(403).json({ message: "Supervisor only" });
  }

  const branchId = Number(req.params.id);
  if (!branchId) return res.status(400).json({ message: "Invalid branch id" });

  const { BRANCH_NAME, CITY, ADDRESS, PHONE, EMAIL } = req.body || {};

  if (!String(BRANCH_NAME || "").trim()) {
    return res.status(400).json({ message: "BRANCH_NAME is required" });
  }
  if (!String(CITY || "").trim()) {
    return res.status(400).json({ message: "CITY is required" });
  }

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

    const r = await conn.execute(
      sql,
      {
        id: branchId,
        name: String(BRANCH_NAME).trim(),
        city: String(CITY).trim(),
        addr: ADDRESS ? String(ADDRESS).trim() : null,
        phone: PHONE ? String(PHONE).trim() : null,
        email: EMAIL ? String(EMAIL).trim() : null,
      },
      { autoCommit: true }
    );

    if ((r.rowsAffected || 0) === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    return res.json({ message: "Branch updated" });
  } catch (e) {
    console.error("BRANCH_UPDATE_ERROR:", e);

    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Duplicate branch data (unique constraint)" });
    }

    return res.status(500).json({ message: e.message || "Failed to update branch" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// =====================================================
// 4) DELETE BRANCH (Supervisor only)
// =====================================================
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) {
    return res.status(403).json({ message: "Supervisor only" });
  }

  const branchId = Number(req.params.id);
  if (!branchId) return res.status(400).json({ message: "Invalid branch id" });

  let conn;
  try {
    conn = await getConnection();

    const r = await conn.execute(
      `DELETE FROM BRANCHES WHERE BRANCH_ID = :id`,
      { id: branchId },
      { autoCommit: true }
    );

    if ((r.rowsAffected || 0) === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    return res.json({ message: "Branch deleted" });
  } catch (e) {
    console.error("BRANCH_DELETE_ERROR:", e);

    // ORA-02292: integrity constraint violated - child record found
    if (String(e.message || "").includes("ORA-02292")) {
      return res.status(400).json({
        message: "Cannot delete branch: It has active cars, managers, customers, rentals, or devices.",
      });
    }

    return res.status(500).json({ message: e.message || "Failed to delete branch" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
