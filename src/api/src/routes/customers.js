// src/api/src/routes/customers.js
// ✅ FULL FILE — compatible with SILVER_LAYER.CUSTOMERS, scoped by role/branch

const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireManager, requireManagerId, requireBranch } = require("../access");

/**
 * GET /api/v1/customers
 * - supervisor: all customers
 * - manager: only customers in their branch
 */
router.get("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const binds = {};
    let sql = `
      SELECT
        c.CUSTOMER_ID,
        c.BRANCH_ID,
        c.MANAGER_ID,
        c.FIRST_NAME,
        c.LAST_NAME,
        c.NATIONAL_ID,
        c.DATE_OF_BIRTH,
        c.DRIVER_LICENSE_NO,
        c.EMAIL,
        c.PHONE,
        c.CREATED_AT
      FROM CUSTOMERS c
    `;

    if (!isSupervisor(req)) {
      sql += ` WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    }

    sql += ` ORDER BY c.CUSTOMER_ID DESC`;

    const r = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json(r.rows || []);
  } catch (e) {
    console.error("CUSTOMERS_GET_ERROR:", e);
    return res.status(e.status || 500).json({ message: e.message || "Failed to fetch customers" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

/**
 * POST /api/v1/customers
 * - only MANAGER can create
 * - customer created in manager's branch
 * - MANAGER_ID = creator
 */
router.post("/", authMiddleware, async (req, res) => {
  let conn;
  try {
    requireManager(req);

    const body = req.body || {};
    const FIRST_NAME = String(body.FIRST_NAME || "").trim();
    const LAST_NAME = String(body.LAST_NAME || "").trim();

    const NATIONAL_ID = body.NATIONAL_ID ? String(body.NATIONAL_ID).trim() : "";
    const DRIVER_LICENSE_NO = body.DRIVER_LICENSE_NO ? String(body.DRIVER_LICENSE_NO).trim() : "";
    const DATE_OF_BIRTH = body.DATE_OF_BIRTH ? String(body.DATE_OF_BIRTH).trim() : ""; // YYYY-MM-DD

    const EMAIL = body.EMAIL ? String(body.EMAIL).trim() : null;
    const PHONE = body.PHONE ? String(body.PHONE).trim() : null;

    if (!FIRST_NAME) return res.status(400).json({ message: "FIRST_NAME is required" });
    if (!LAST_NAME) return res.status(400).json({ message: "LAST_NAME is required" });
    if (!NATIONAL_ID) return res.status(400).json({ message: "NATIONAL_ID is required" });
    if (!DATE_OF_BIRTH) return res.status(400).json({ message: "DATE_OF_BIRTH is required (YYYY-MM-DD)" });
    if (!DRIVER_LICENSE_NO) return res.status(400).json({ message: "DRIVER_LICENSE_NO is required" });

    conn = await getConnection();

    const branchId = Number(requireBranch(req));
    const managerId = Number(requireManagerId(req));

    const sql = `
      INSERT INTO CUSTOMERS (
        BRANCH_ID, MANAGER_ID,
        FIRST_NAME, LAST_NAME,
        NATIONAL_ID, DATE_OF_BIRTH,
        DRIVER_LICENSE_NO,
        EMAIL, PHONE
      )
      VALUES (
        :branchId, :managerId,
        :fn, :ln,
        :nid, TO_DATE(:dob, 'YYYY-MM-DD'),
        :lic,
        :email, :phone
      )
      RETURNING CUSTOMER_ID INTO :outId
    `;

    const r = await conn.execute(
      sql,
      {
        branchId,
        managerId,
        fn: FIRST_NAME,
        ln: LAST_NAME,
        nid: NATIONAL_ID,
        dob: DATE_OF_BIRTH,
        lic: DRIVER_LICENSE_NO,
        email: EMAIL,
        phone: PHONE,
        outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    return res.status(201).json({
      CUSTOMER_ID: r.outBinds.outId[0],
      BRANCH_ID: branchId,
      MANAGER_ID: managerId,
    });
  } catch (e) {
    console.error("CUSTOMERS_POST_ERROR:", e);
    if (String(e.message || "").includes("ORA-00001")) {
      return res.status(409).json({ message: "Duplicate NATIONAL_ID / DRIVER_LICENSE_NO / EMAIL" });
    }
    return res.status(e.status || 500).json({ message: e.message || "Failed to create customer" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

/**
 * DELETE /api/v1/customers/:id
 * - only MANAGER can delete
 * - only within manager branch
 */
router.delete("/:id", authMiddleware, async (req, res) => {
  let conn;
  try {
    requireManager(req);

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid customer id" });

    conn = await getConnection();

    const branchId = Number(requireBranch(req));

    const r = await conn.execute(
      `DELETE FROM CUSTOMERS WHERE CUSTOMER_ID = :id AND BRANCH_ID = :branchId`,
      { id, branchId },
      { autoCommit: true }
    );

    if ((r.rowsAffected || 0) === 0) {
      return res.status(404).json({ message: "Customer not found in your branch" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("CUSTOMERS_DELETE_ERROR:", e);
    return res.status(e.status || 500).json({ message: e.message || "Failed to delete customer" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
