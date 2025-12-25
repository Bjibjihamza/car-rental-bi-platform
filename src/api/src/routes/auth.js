// src/api/src/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");

const router = express.Router();

function signUser(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function normalizeRole(dbRole) {
  return String(dbRole).toUpperCase() === "SUPERVISOR" ? "supervisor" : "manager";
}

// ===============================
// LOGIN (bcrypt ONLY) - SILVER
// ===============================
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

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
        MANAGER_PASSWORD,
        BRANCH_ID,
        ROLE
      FROM MANAGERS
      WHERE LOWER(EMAIL) = LOWER(:email)
      `,
      { email }
    );

    const row = r.rows?.[0];
    if (!row) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const storedHash = String(row.MANAGER_PASSWORD || "").trim();

    // 🔐 bcrypt ONLY
    const ok = await bcrypt.compare(String(password), storedHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = {
      managerId: row.MANAGER_ID,
      managerCode: row.MANAGER_CODE,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      email: row.EMAIL,
      phone: row.PHONE ?? null,
      branchId: row.BRANCH_ID ?? null,
      role: normalizeRole(row.ROLE),
    };

    const token = signUser(payload);
    return res.json({ token, user: payload });

  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

/* ===============================
   GET CURRENT USER (ME)
================================ */
router.get("/me", authMiddleware, async (req, res) => {
  return res.json({ user: req.user });
});

/* ===============================
   UPDATE PROFILE (NAME/EMAIL/PHONE)
   Returns NEW TOKEN + USER
================================ */
router.put("/me", authMiddleware, async (req, res) => {
  const { firstName, lastName, email, phone } = req.body ?? {};
  const managerId = req?.user?.managerId;

  if (!managerId) return res.status(401).json({ message: "Invalid token" });
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ message: "firstName, lastName, email are required" });
  }

  let conn;
  try {
    conn = await getConnection();

    const chk = await conn.execute(
      `SELECT 1 FROM MANAGERS WHERE LOWER(EMAIL)=LOWER(:email) AND MANAGER_ID <> :id`,
      { email, id: managerId }
    );
    if ((chk.rows || []).length > 0) {
      return res.status(409).json({ message: "Email already used by another account" });
    }

    await conn.execute(
      `
      UPDATE MANAGERS
      SET FIRST_NAME = :firstName,
          LAST_NAME  = :lastName,
          EMAIL      = :email,
          PHONE      = :phone
      WHERE MANAGER_ID = :id
      `,
      {
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: String(email).trim(),
        phone: phone ? String(phone).trim() : null,
        id: managerId,
      },
      { autoCommit: true }
    );

    const r = await conn.execute(
      `
      SELECT
        MANAGER_ID,
        MANAGER_CODE,
        FIRST_NAME,
        LAST_NAME,
        EMAIL,
        PHONE,
        BRANCH_ID,
        ROLE
      FROM MANAGERS
      WHERE MANAGER_ID = :id
      `,
      { id: managerId }
    );

    const row = r.rows?.[0];
    if (!row) return res.status(404).json({ message: "User not found" });

    const payload = {
      managerId: row.MANAGER_ID,
      managerCode: row.MANAGER_CODE,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      email: row.EMAIL,
      phone: row.PHONE ?? null,
      branchId: row.BRANCH_ID ?? null,
      role: normalizeRole(row.ROLE),
    };

    const token = signUser(payload);
    return res.json({ token, user: payload });
  } catch (err) {
    console.error("PROFILE_UPDATE_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

// ===============================
// CHANGE PASSWORD (bcrypt ONLY)
// ===============================
router.put("/me/password", authMiddleware, async (req, res) => {
  const managerId = req?.user?.managerId;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!managerId) {
    return res.status(401).json({ message: "Invalid token" });
  }
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  let conn;
  try {
    conn = await getConnection();

    const r = await conn.execute(
      `SELECT MANAGER_PASSWORD FROM MANAGERS WHERE MANAGER_ID = :id`,
      { id: managerId }
    );

    const row = r.rows?.[0];
    if (!row) {
      return res.status(404).json({ message: "User not found" });
    }

    const storedHash = String(row.MANAGER_PASSWORD || "").trim();

    // 🔐 bcrypt ONLY
    const ok = await bcrypt.compare(String(currentPassword), storedHash);
    if (!ok) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(String(newPassword), 12);

    await conn.execute(
      `UPDATE MANAGERS SET MANAGER_PASSWORD = :pwd WHERE MANAGER_ID = :id`,
      { pwd: newHash, id: managerId },
      { autoCommit: true }
    );

    return res.json({ ok: true });

  } catch (err) {
    console.error("PASSWORD_UPDATE_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
