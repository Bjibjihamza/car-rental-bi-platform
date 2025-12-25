// src/api/src/routes/managers.js
// ✅ FULL FILE — SILVER compatible (MANAGERS schema + supervisor rules)
// ✅ NOTE: This file returns OBJECT rows because db.js already sets OUT_FORMAT_OBJECT.

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor } = require("../access");

function normalizeRole(dbRole) {
  return String(dbRole || "").toUpperCase() === "SUPERVISOR" ? "supervisor" : "manager";
}

// ===============================
// 0) GET ME ✅ /api/v1/managers/me
// ===============================
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
      { id: Number(managerId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ message: "User not found" });

    return res.json({
      managerId: row.MANAGER_ID,
      managerCode: row.MANAGER_CODE,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      email: row.EMAIL,
      phone: row.PHONE ?? null,
      role: normalizeRole(row.ROLE),
      branchId: row.BRANCH_ID ?? null,
      hireDate: row.HIRE_DATE ?? null,
    });
  } catch (e) {
    console.error("MANAGERS_ME_GET_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// ===============================
// 0b) UPDATE ME ✅ /api/v1/managers/me
// ===============================
router.put("/me", authMiddleware, async (req, res) => {
  const managerId = req?.user?.managerId;
  if (!managerId) return res.status(401).json({ message: "Invalid token" });

  const { FIRST_NAME, LAST_NAME, EMAIL, PHONE } = req.body || {};
  if (!FIRST_NAME || !LAST_NAME || !EMAIL) {
    return res.status(400).json({ message: "FIRST_NAME, LAST_NAME, EMAIL are required" });
  }

  let conn;
  try {
    conn = await getConnection();

    const chk = await conn.execute(
      `
      SELECT 1
      FROM MANAGERS
      WHERE LOWER(EMAIL) = LOWER(:email)
        AND MANAGER_ID <> :id
      FETCH FIRST 1 ROWS ONLY
      `,
      { email: String(EMAIL), id: Number(managerId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
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
        id: Number(managerId),
      },
      { autoCommit: true }
    );

    return res.json({ message: "Profile updated" });
  } catch (e) {
    console.error("MANAGERS_ME_PUT_ERROR:", e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// ===============================
// 0c) CHANGE PASSWORD ✅ /api/v1/managers/me/password
// ===============================
router.put("/me/password", authMiddleware, async (req, res) => {
  const managerId = req?.user?.managerId;
  if (!managerId) return res.status(401).json({ message: "Invalid token" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  let conn;
  try {
    conn = await getConnection();

    const r = await conn.execute(
      `SELECT MANAGER_PASSWORD FROM MANAGERS WHERE MANAGER_ID = :id`,
      { id: Number(managerId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ message: "User not found" });

    const storedHash = String(row.MANAGER_PASSWORD || "").trim();
    const ok = await bcrypt.compare(String(currentPassword), storedHash);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const hash = await bcrypt.hash(String(newPassword), 12);
    await conn.execute(
      `UPDATE MANAGERS SET MANAGER_PASSWORD = :pwd WHERE MANAGER_ID = :id`,
      { pwd: hash, id: Number(managerId) },
      { autoCommit: true }
    );

    return res.json({ message: "Password updated" });
  } catch (e) {
    console.error("MANAGERS_ME_PASSWORD_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// ===============================
// 1) GET MANAGERS
// - Supervisor: all
// - Manager: only himself
// ===============================
router.get("/", authMiddleware, async (req, res) => {
  const sup = isSupervisor(req);
  const myId = Number(req?.user?.managerId);

  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `
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
    `;

    if (!sup) {
      sql += ` WHERE MANAGER_ID = :me`;
      binds.me = myId;
    }

    sql += ` ORDER BY MANAGER_ID DESC`;

    const r = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json(r.rows || []);
  } catch (e) {
    console.error("MANAGERS_GET_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// ===============================
// 2) CREATE MANAGER (Supervisor only)
// ===============================
router.post("/", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const body = req.body || {};
  const MANAGER_CODE = String(body.MANAGER_CODE || "").trim();
  const FIRST_NAME = String(body.FIRST_NAME || "").trim();
  const LAST_NAME = String(body.LAST_NAME || "").trim();
  const EMAIL = String(body.EMAIL || "").trim();
  const PHONE = body.PHONE ? String(body.PHONE).trim() : null;
  const ROLE = String(body.ROLE || "MANAGER").toUpperCase();
  const BRANCH_ID = body.BRANCH_ID != null ? Number(body.BRANCH_ID) : null;
  const MANAGER_PASSWORD = String(body.MANAGER_PASSWORD || "").trim();

  if (!MANAGER_CODE || !FIRST_NAME || !LAST_NAME || !EMAIL || !MANAGER_PASSWORD) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  if (!["SUPERVISOR", "MANAGER"].includes(ROLE)) {
    return res.status(400).json({ message: "Invalid ROLE" });
  }
  if (ROLE === "MANAGER" && !BRANCH_ID) {
    return res.status(400).json({ message: "BRANCH_ID required for MANAGER" });
  }
  if (ROLE === "SUPERVISOR" && BRANCH_ID) {
    return res.status(400).json({ message: "SUPERVISOR cannot have BRANCH_ID" });
  }

  let conn;
  try {
    conn = await getConnection();

    const hash = await bcrypt.hash(MANAGER_PASSWORD, 12);

    const r = await conn.execute(
      `
      INSERT INTO MANAGERS
        (MANAGER_CODE, FIRST_NAME, LAST_NAME, EMAIL, PHONE, MANAGER_PASSWORD, ROLE, BRANCH_ID)
      VALUES
        (:code, :fn, :ln, :email, :phone, :pwd, :role, :branchId)
      RETURNING MANAGER_ID INTO :id
      `,
      {
        code: MANAGER_CODE,
        fn: FIRST_NAME,
        ln: LAST_NAME,
        email: EMAIL,
        phone: PHONE,
        pwd: hash,
        role: ROLE,
        branchId: ROLE === "MANAGER" ? BRANCH_ID : null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    return res.status(201).json({ MANAGER_ID: r.outBinds.id[0], message: "Manager created" });
  } catch (e) {
    console.error("MANAGERS_POST_ERROR:", e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Code or Email already exists" });
    }
    return res.status(500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// ===============================
// 3) EDIT MANAGER (Supervisor only)
// ===============================
router.put("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const managerId = Number(req.params.id);
  if (!managerId) return res.status(400).json({ message: "Invalid manager id" });

  const body = req.body || {};
  const MANAGER_CODE = String(body.MANAGER_CODE || "").trim();
  const FIRST_NAME = String(body.FIRST_NAME || "").trim();
  const LAST_NAME = String(body.LAST_NAME || "").trim();
  const EMAIL = String(body.EMAIL || "").trim();
  const PHONE = body.PHONE ? String(body.PHONE).trim() : null;
  const ROLE = String(body.ROLE || "MANAGER").toUpperCase();
  const BRANCH_ID = body.BRANCH_ID != null ? Number(body.BRANCH_ID) : null;
  const MANAGER_PASSWORD = body.MANAGER_PASSWORD ? String(body.MANAGER_PASSWORD).trim() : "";

  if (!MANAGER_CODE || !FIRST_NAME || !LAST_NAME || !EMAIL) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  if (!["SUPERVISOR", "MANAGER"].includes(ROLE)) {
    return res.status(400).json({ message: "Invalid ROLE" });
  }
  if (ROLE === "MANAGER" && !BRANCH_ID) {
    return res.status(400).json({ message: "BRANCH_ID required for MANAGER" });
  }
  if (ROLE === "SUPERVISOR" && BRANCH_ID) {
    return res.status(400).json({ message: "SUPERVISOR cannot have BRANCH_ID" });
  }

  let conn;
  try {
    conn = await getConnection();

    let sql = `
      UPDATE MANAGERS
      SET MANAGER_CODE = :code,
          FIRST_NAME   = :fn,
          LAST_NAME    = :ln,
          EMAIL        = :email,
          PHONE        = :phone,
          ROLE         = :role,
          BRANCH_ID    = :branchId
    `;

    const binds = {
      id: managerId,
      code: MANAGER_CODE,
      fn: FIRST_NAME,
      ln: LAST_NAME,
      email: EMAIL,
      phone: PHONE,
      role: ROLE,
      branchId: ROLE === "MANAGER" ? BRANCH_ID : null,
    };

    if (MANAGER_PASSWORD) {
      const hash = await bcrypt.hash(MANAGER_PASSWORD, 12);
      sql += `, MANAGER_PASSWORD = :pwd`;
      binds.pwd = hash;
    }

    sql += ` WHERE MANAGER_ID = :id`;

    const r = await conn.execute(sql, binds, { autoCommit: true });
    if ((r.rowsAffected || 0) === 0) return res.status(404).json({ message: "Manager not found" });

    return res.json({ message: "Manager updated" });
  } catch (e) {
    console.error("MANAGERS_PUT_ERROR:", e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Code or Email already exists" });
    }
    return res.status(500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

// ===============================
// 4) DELETE MANAGER (Supervisor only)
// ===============================
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!isSupervisor(req)) return res.status(403).json({ message: "Supervisor only" });

  const managerId = Number(req.params.id);
  if (!managerId) return res.status(400).json({ message: "Invalid manager id" });

  if (Number(managerId) === Number(req?.user?.managerId)) {
    return res.status(400).json({ message: "You cannot delete yourself." });
  }

  let conn;
  try {
    conn = await getConnection();

    const r = await conn.execute(
      `DELETE FROM MANAGERS WHERE MANAGER_ID = :id`,
      { id: managerId },
      { autoCommit: true }
    );

    if ((r.rowsAffected || 0) === 0) return res.status(404).json({ message: "Manager not found" });

    return res.json({ message: "Manager deleted" });
  } catch (e) {
    console.error("MANAGERS_DELETE_ERROR:", e);
    if (String(e.message || "").includes("ORA-02292")) {
      return res.status(400).json({ message: "Cannot delete: Manager has associated records." });
    }
    return res.status(500).json({ message: e.message || "Failed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
