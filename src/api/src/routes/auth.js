// src/api/src/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { getConnection } = require("../db");

const router = express.Router();

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

    // Support both OBJECT and ARRAY row formats
    const get = (key, idx) =>
      row && typeof row === "object" && !Array.isArray(row) ? row[key] : row[idx];

    const managerId   = get("MANAGER_ID", 0);
    const managerCode = get("MANAGER_CODE", 1);
    const firstName   = get("FIRST_NAME", 2);
    const lastName    = get("LAST_NAME", 3);
    const emailDb     = get("EMAIL", 4);
    const storedPwd   = String(get("MANAGER_PASSWORD", 5) || "").trim();
    const branchId    = get("BRANCH_ID", 6);
    const dbRole      = get("ROLE", 7);

    // 🔴 PLAINTEXT PASSWORD CHECK (DEV ONLY)
    if (String(password).trim() !== storedPwd) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Normalize role for frontend
    const role =
      String(dbRole).toUpperCase() === "SUPERVISOR"
        ? "supervisor"
        : "manager";

    const payload = {
      managerId,
      managerCode,
      email: emailDb,
      firstName,
      lastName,
      branchId: branchId ?? null,
      role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    });

    return res.json({ token, user: payload });
  } catch (err) {
    console.error("LOGIN_ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
