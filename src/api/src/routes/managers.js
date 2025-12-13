const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor } = require("../access");

// 1. GET MANAGERS (Already exists, kept for context)
router.get("/", authMiddleware, async (req, res) => {
  const user = req.user;
  const sup = isSupervisor(req);
  let conn;
  try {
    conn = await getConnection();
    const binds = {};
    let sql = `
      SELECT MANAGER_ID, MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ROLE, BRANCH_ID, HIRE_DATE
      FROM MANAGERS m
    `;
    if (!sup) {
      sql += ` WHERE m.MANAGER_ID = :me`;
      binds.me = user.managerId;
    }
    sql += ` ORDER BY m.MANAGER_ID DESC`;
    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 2. CREATE MANAGER (Supervisor Only)
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const { MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ROLE, BRANCH_ID, MANAGER_PASSWORD } = req.body || {};
  const role = String(ROLE || "MANAGER").toUpperCase();

  if (!["SUPERVISOR", "MANAGER"].includes(role)) return res.status(400).json({ message: "Invalid Role" });
  if (!MANAGER_CODE || !FIRST_NAME || !LAST_NAME || !EMAIL || !MANAGER_PASSWORD) return res.status(400).json({ message: "Missing required fields" });

  if (role === "MANAGER" && !BRANCH_ID) return res.status(400).json({ message: "Branch required for Manager" });
  if (role === "SUPERVISOR" && BRANCH_ID) return res.status(400).json({ message: "Supervisor cannot have a branch" });

  let conn;
  try {
    conn = await getConnection();
    const oracledb = require("oracledb");
    const hash = await bcrypt.hash(String(MANAGER_PASSWORD), 10);

    const sql = `
      INSERT INTO MANAGERS (MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, MANAGER_PASSWORD, ROLE, BRANCH_ID)
      VALUES (:code, :fn, :ln, :email, :phone, :pwd, :role, :branchId)
      RETURNING MANAGER_ID INTO :id
    `;
    const binds = {
      code: MANAGER_CODE, fn: FIRST_NAME, ln: LAST_NAME, email: EMAIL, phone: PHONE || null,
      pwd: hash, role, branchId: role === "MANAGER" ? Number(BRANCH_ID) : null,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    res.json({ MANAGER_ID: r.outBinds.id[0], message: "Manager created" });
  } catch (e) {
    console.error(e);
    if (e.message.includes("ORA-00001")) return res.status(409).json({ message: "Code or Email already exists" });
    res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 3. EDIT MANAGER (Supervisor Only)
router.put("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const managerId = req.params.id;
  const { MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ROLE, BRANCH_ID, MANAGER_PASSWORD } = req.body || {};
  const role = String(ROLE || "MANAGER").toUpperCase();

  if (role === "MANAGER" && !BRANCH_ID) return res.status(400).json({ message: "Branch required for Manager" });
  if (role === "SUPERVISOR" && BRANCH_ID) return res.status(400).json({ message: "Supervisor cannot have a branch" });

  let conn;
  try {
    conn = await getConnection();
    
    let sql = `
      UPDATE MANAGERS 
      SET MANAGER_CODE = :code,
          FIRST_NAME = :fn,
          LAST_NAME = :ln,
          EMAIL = :email,
          PHONE = :phone,
          ROLE = :role,
          BRANCH_ID = :branchId
    `;
    
    const binds = {
      id: managerId,
      code: MANAGER_CODE, fn: FIRST_NAME, ln: LAST_NAME, email: EMAIL, phone: PHONE || null,
      role, branchId: role === "MANAGER" ? Number(BRANCH_ID) : null
    };

    // Only update password if provided
    if (MANAGER_PASSWORD && String(MANAGER_PASSWORD).trim()) {
       const hash = await bcrypt.hash(String(MANAGER_PASSWORD), 10);
       sql += `, MANAGER_PASSWORD = :pwd`;
       binds.pwd = hash;
    }

    sql += ` WHERE MANAGER_ID = :id`;

    const r = await conn.execute(sql, binds, { autoCommit: true });
    if (r.rowsAffected === 0) return res.status(404).json({ message: "Manager not found" });

    res.json({ message: "Manager updated" });
  } catch (e) {
    console.error(e);
    if (e.message.includes("ORA-00001")) return res.status(409).json({ message: "Code or Email already exists" });
    res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 4. DELETE MANAGER (Supervisor Only)
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const managerId = req.params.id;
  // Prevent self-deletion if you want (optional)
  if (Number(managerId) === Number(req.user.managerId)) {
      return res.status(400).json({ message: "You cannot delete yourself." });
  }

  let conn;
  try {
    conn = await getConnection();
    // Check FK constraints (e.g. rentals created by this manager)
    // If you want to keep history, maybe just set active=0, but here we DELETE.
    const sql = `DELETE FROM MANAGERS WHERE MANAGER_ID = :id`;
    const r = await conn.execute(sql, { id: managerId }, { autoCommit: true });

    if (r.rowsAffected === 0) return res.status(404).json({ message: "Manager not found" });
    res.json({ message: "Manager deleted" });
  } catch (e) {
    console.error(e);
    if (e.message.includes("ORA-02292")) return res.status(400).json({ message: "Cannot delete: Manager has associated records (Rentals/Logs)." });
    res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;