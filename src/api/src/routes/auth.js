// src/api/src/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getConnection } = require("../db");

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * body: { email, password }
 */
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
        BRANCH_ID
      FROM MANAGERS
      WHERE LOWER(EMAIL) = LOWER(:email)
      `,
      { email }
    );

    const row = r.rows?.[0];
    if (!row) return res.status(401).json({ message: "Invalid credentials" });

    // si OUT_FORMAT_OBJECT est activé (recommandé)
    const stored = row.MANAGER_PASSWORD;

    // OPTION A (RECOMMANDÉE) : mot de passe hashé bcrypt
    const looksHashed = typeof stored === "string" && stored.startsWith("$2");
    const ok = looksHashed ? await bcrypt.compare(password, stored) : (password === stored); // OPTION B fallback demo

    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const payload = {
      managerId: row.MANAGER_ID,
      email: row.EMAIL,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      branchId: row.BRANCH_ID,
      managerCode: row.MANAGER_CODE,
      role: "manager",
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
