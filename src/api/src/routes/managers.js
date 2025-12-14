// src/api/src/routes/managers.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor } = require("../access");

// 0. GET ME (NEW)  ✅ /api/v1/managers/me
router.get("/me", authMiddleware, async (req, res) => {
  const managerId = req?.user?.managerId;
  if (!managerId) return res.status(401).json({ message: "Invalid token" });

  let conn;
  try {
    conn = await getConnection();
    const r = await conn.execute(
      `
      SELECT
        MANAGER_ID,
        MANAGER_CODE,
        FIRST_NAME,
        LAST_NAME,
        EMAIL,
        PHONE,
        ROLE,
        BRANCH_ID,
        HIRE_DATE
      FROM MANAGERS
      WHERE MANAGER_ID = :id
      `,
      { id: managerId }
    );

    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ message: "User not found" });

    const role =
      String(row.ROLE || "").toUpperCase() === "SUPERVISOR"
        ? "supervisor"
        : "manager";

    return res.json({
      managerId: row.MANAGER_ID,
      managerCode: row.MANAGER_CODE,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      email: row.EMAIL,
      phone: row.PHONE ?? null,
      role,
      branchId: row.BRANCH_ID ?? null,
      hireDate: row.HIRE_DATE ?? null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// 0b. UPDATE ME (NEW) ✅ /api/v1/managers/me
router.put("/me", authMiddleware, async (req, res) => {
  const managerId = req?.user?.managerId;
  if (!managerId) return res.status(401).json({ message: "Invalid token" });

  const { FIRST_NAME, LAST_NAME, EMAIL, PHONE } = req.body || {};
  if (!FIRST_NAME || !LAST_NAME || !EMAIL) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let conn;
  try {
    conn = await getConnection();

    // Email uniqueness (excluding self)
    const chk = await conn.execute(
      `
      SELECT 1
      FROM MANAGERS
      WHERE LOWER(EMAIL) = LOWER(:email)
        AND MANAGER_ID <> :id
      FETCH FIRST 1 ROWS ONLY
      `,
      { email: EMAIL, id: managerId }
    );

    if ((chk.rows || []).length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    await conn.execute(
      `
      UPDATE MANAGERS
      SET FIRST_NAME = :fn,
          LAST_NAME  = :ln,
          EMAIL      = :email,
          PHONE      = :phone
      WHERE MANAGER_ID = :id
      `,
      {
        fn: String(FIRST_NAME).trim(),
        ln: String(LAST_NAME).trim(),
        email: String(EMAIL).trim(),
        phone: PHONE ? String(PHONE).trim() : null,
        id: managerId,
      },
      { autoCommit: true }
    );

    return res.json({ message: "Profile updated" });
  } catch (e) {
    console.error(e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: e.message });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// 0c. CHANGE PASSWORD (NEW) ✅ /api/v1/managers/me/password
router.put("/me/password", authMiddleware, async (req, res) => {
  const managerId = req?.user?.managerId;
  if (!managerId) return res.status(401).json({ message: "Invalid token" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  }

  let conn;
  try {
    conn = await getConnection();

    const r = await conn.execute(
      `SELECT MANAGER_PASSWORD FROM MANAGERS WHERE MANAGER_ID = :id`,
      { id: managerId }
    );
    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ message: "User not found" });

    const storedHash = row.MANAGER_PASSWORD;
    const ok = await bcrypt.compare(String(currentPassword), String(storedHash || ""));
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const hash = await bcrypt.hash(String(newPassword), 10);
    await conn.execute(
      `UPDATE MANAGERS SET MANAGER_PASSWORD = :pwd WHERE MANAGER_ID = :id`,
      { pwd: hash, id: managerId },
      { autoCommit: true }
    );

    return res.json({ message: "Password updated" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// 1. GET MANAGERS (existing)
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
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// 2. CREATE MANAGER (Supervisor Only)
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const { MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ROLE, BRANCH_ID, MANAGER_PASSWORD } = req.body || {};
  const role = String(ROLE || "MANAGER").toUpperCase();

  if (!["SUPERVISOR", "MANAGER"].includes(role)) return res.status(400).json({ message: "Invalid Role" });
  if (!MANAGER_CODE || !FIRST_NAME || !LAST_NAME || !EMAIL || !MANAGER_PASSWORD)
    return res.status(400).json({ message: "Missing required fields" });

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
      code: MANAGER_CODE,
      fn: FIRST_NAME,
      ln: LAST_NAME,
      email: EMAIL,
      phone: PHONE || null,
      pwd: hash,
      role,
      branchId: role === "MANAGER" ? Number(BRANCH_ID) : null,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const r = await conn.execute(sql, binds, { autoCommit: true });
    res.json({ MANAGER_ID: r.outBinds.id[0], message: "Manager created" });
  } catch (e) {
    console.error(e);
    if (String(e.message || "").includes("ORA-00001"))
      return res.status(409).json({ message: "Code or Email already exists" });
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
      code: MANAGER_CODE,
      fn: FIRST_NAME,
      ln: LAST_NAME,
      email: EMAIL,
      phone: PHONE || null,
      role,
      branchId: role === "MANAGER" ? Number(BRANCH_ID) : null,
    };

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
    if (String(e.message || "").includes("ORA-00001"))
      return res.status(409).json({ message: "Code or Email already exists" });
    res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// 4. DELETE MANAGER (Supervisor Only)
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const managerId = req.params.id;
  if (Number(managerId) === Number(req.user.managerId)) {
    return res.status(400).json({ message: "You cannot delete yourself." });
  }

  let conn;
  try {
    conn = await getConnection();
    const sql = `DELETE FROM MANAGERS WHERE MANAGER_ID = :id`;
    const r = await conn.execute(sql, { id: managerId }, { autoCommit: true });

    if (r.rowsAffected === 0) return res.status(404).json({ message: "Manager not found" });
    res.json({ message: "Manager deleted" });
  } catch (e) {
    console.error(e);
    if (String(e.message || "").includes("ORA-02292"))
      return res.status(400).json({ message: "Cannot delete: Manager has associated records (Rentals/Logs)." });
    res.status(500).json({ message: e.message });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
