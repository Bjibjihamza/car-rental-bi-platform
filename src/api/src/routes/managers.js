// src/api/src/routes/managers.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor } = require("../access");

/**
 * GET /api/v1/managers
 * - Supervisor: all managers
 * - Manager: only himself
 */
router.get("/", authMiddleware, async (req, res) => {
  const user = req.user; // from JWT
  const sup = isSupervisor(req);

  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `
      SELECT
        m.MANAGER_ID,
        m.MANAGER_CODE,
        m.FIRST_NAME,
        m.LAST_NAME,
        m.EMAIL,
        m.PHONE,
        m.ROLE,
        m.BRANCH_ID,
        m.HIRE_DATE
      FROM MANAGERS m
    `;

    if (!sup) {
      sql += ` WHERE m.MANAGER_ID = :me`;
      binds.me = user.managerId; // make sure your auth sets this
    }

    sql += ` ORDER BY m.MANAGER_ID DESC`;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message || "Failed to fetch managers" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

/**
 * POST /api/v1/managers
 * Supervisor only
 */
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const {
    MANAGER_CODE,
    FIRST_NAME,
    LAST_NAME,
    EMAIL,
    PHONE = null,
    ROLE = "MANAGER",
    BRANCH_ID = null,
    MANAGER_PASSWORD,
  } = req.body || {};

  const role = String(ROLE || "MANAGER").toUpperCase();
  if (!["SUPERVISOR", "MANAGER"].includes(role)) {
    return res.status(400).json({ message: "ROLE must be SUPERVISOR or MANAGER" });
  }

  if (!String(MANAGER_CODE || "").trim()) return res.status(400).json({ message: "MANAGER_CODE is required" });
  if (!String(FIRST_NAME || "").trim()) return res.status(400).json({ message: "FIRST_NAME is required" });
  if (!String(LAST_NAME || "").trim()) return res.status(400).json({ message: "LAST_NAME is required" });
  if (!String(EMAIL || "").trim()) return res.status(400).json({ message: "EMAIL is required" });
  if (!String(MANAGER_PASSWORD || "").trim()) return res.status(400).json({ message: "MANAGER_PASSWORD is required" });

  // enforce branch rules like your DB constraint
  if (role === "MANAGER" && (BRANCH_ID === null || BRANCH_ID === "")) {
    return res.status(400).json({ message: "BRANCH_ID is required for MANAGER" });
  }
  if (role === "SUPERVISOR" && BRANCH_ID) {
    return res.status(400).json({ message: "SUPERVISOR must not have BRANCH_ID" });
  }

  let conn;
  try {
    conn = await getConnection();
    const oracledb = require("oracledb");

    const hash = await bcrypt.hash(String(MANAGER_PASSWORD), 10);

    const sql = `
      INSERT INTO MANAGERS (
        MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE,
        MANAGER_PASSWORD, ROLE, BRANCH_ID
      ) VALUES (
        :code, :fn, :ln, :email, :phone,
        :pwd, :role, :branchId
      )
      RETURNING MANAGER_ID INTO :id
    `;

    const binds = {
      code: String(MANAGER_CODE).trim(),
      fn: String(FIRST_NAME).trim(),
      ln: String(LAST_NAME).trim(),
      email: String(EMAIL).trim(),
      phone: PHONE ? String(PHONE).trim() : null,
      pwd: hash,
      role,
      branchId: role === "MANAGER" ? Number(BRANCH_ID) : null,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    res.json({ MANAGER_ID: r.outBinds.id[0] });
  } catch (e) {
    console.error(e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "MANAGER_CODE or EMAIL already exists" });
    }
    res.status(500).json({ message: e.message || "Failed to create manager" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
