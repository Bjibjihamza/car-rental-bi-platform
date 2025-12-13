// src/api/src/routes/rentals.js
const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

function requireBody(res, body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === "") {
      res.status(400).json({ message: `Missing field: ${f}` });
      return false;
    }
  }
  return true;
}

/**
 * GET /api/v1/rentals
 * Supervisor => all rentals
 * Manager    => only rentals for his branch
 */
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `
      SELECT
        r.RENTAL_ID,
        r.CAR_ID,
        r.CUSTOMER_ID,
        r.BRANCH_ID,
        r.MANAGER_ID,
        r.START_AT,
        r.DUE_AT,
        r.RETURN_AT,
        r.STATUS,
        r.START_ODOMETER,
        r.END_ODOMETER,
        r.TOTAL_AMOUNT,
        r.CURRENCY,
        r.CREATED_AT,

        -- extra display fields
        b.CITY AS BRANCH_CITY,
        c.LICENSE_PLATE,
        c.MAKE,
        c.MODEL,
        cu.FIRST_NAME AS CUSTOMER_FIRST_NAME,
        cu.LAST_NAME  AS CUSTOMER_LAST_NAME
      FROM RENTALS r
      JOIN BRANCHES b ON b.BRANCH_ID = r.BRANCH_ID
      JOIN CARS c     ON c.CAR_ID = r.CAR_ID
      JOIN CUSTOMERS cu ON cu.CUSTOMER_ID = r.CUSTOMER_ID
    `;

    if (!isSupervisor(req)) {
      sql += ` WHERE r.BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    sql += ` ORDER BY r.RENTAL_ID DESC`;

    const r = await conn.execute(sql, binds);
    res.json(r.rows || []);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: e.message || "Failed to fetch rentals" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

/**
 * POST /api/v1/rentals
 * Create a rental (manager/supervisor)
 * - manager => branch forced from JWT
 * - supervisor => must provide BRANCH_ID
 */
router.post("/", authMiddleware, async (req, res) => {
  const user = req.user;

  const body = req.body || {};
  const ok = requireBody(res, body, ["CAR_ID", "CUSTOMER_ID", "START_AT", "DUE_AT"]);
  if (!ok) return;

  let conn;
  try {
    conn = await getConnection();

    // branch control
    const branchId = user.role === "supervisor"
      ? Number(body.BRANCH_ID)
      : requireBranch(req);

    if (user.role === "supervisor" && !branchId) {
      return res.status(400).json({ message: "Missing field: BRANCH_ID" });
    }

    // Insert
    const result = await conn.execute(
      `
      INSERT INTO RENTALS (
        CAR_ID, CUSTOMER_ID, BRANCH_ID, MANAGER_ID,
        START_AT, DUE_AT, RETURN_AT,
        STATUS,
        START_ODOMETER, END_ODOMETER,
        TOTAL_AMOUNT, CURRENCY
      )
      VALUES (
        :carId, :customerId, :branchId, :managerId,
        TO_TIMESTAMP(:startAt, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
        TO_TIMESTAMP(:dueAt,   'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
        NULL,
        :status,
        :startOdo, NULL,
        :totalAmount, :currency
      )
      RETURNING RENTAL_ID INTO :outId
      `,
      {
        carId: Number(body.CAR_ID),
        customerId: Number(body.CUSTOMER_ID),
        branchId: Number(branchId),
        managerId: user.role === "manager" ? Number(user.managerId) : (body.MANAGER_ID ? Number(body.MANAGER_ID) : null),

        startAt: String(body.START_AT),
        dueAt: String(body.DUE_AT),

        status: (body.STATUS || "ACTIVE").toUpperCase(),
        startOdo: body.START_ODOMETER != null ? Number(body.START_ODOMETER) : null,
        totalAmount: body.TOTAL_AMOUNT != null ? Number(body.TOTAL_AMOUNT) : null,
        currency: (body.CURRENCY || "MAD").toUpperCase(),

        outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    res.status(201).json({ RENTAL_ID: result.outBinds.outId[0] });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ message: e.message || "Failed to create rental" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;
