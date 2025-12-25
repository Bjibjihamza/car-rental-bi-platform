// src/api/src/routes/analytics.js
const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");
const { getGoldConnection, getSilverConnection } = require("../db");

// Helper: safely run on GOLD first, fallback to SILVER
async function tryGoldThenSilver(runGold, runSilver) {
  try {
    const gold = await getGoldConnection();
    try {
      return await runGold(gold);
    } finally {
      await gold.close();
    }
  } catch (e) {
    const silver = await getSilverConnection();
    try {
      return await runSilver(silver);
    } finally {
      await silver.close();
    }
  }
}

/* =========================================================
   GET /api/v1/analytics/dashboard/overview
========================================================= */
router.get("/dashboard/overview", authMiddleware, async (req, res) => {
  try {
    const branchFilter = !isSupervisor(req);
    const branchId = branchFilter ? Number(requireBranch(req)) : null;

    const data = await tryGoldThenSilver(
      async (conn) => {
        const binds = {};
        let where = "WHERE 1=1";
        if (branchFilter) {
          where += " AND BRANCH_ID = :branchId";
          binds.branchId = branchId;
        }
        where += " AND DATE_KEY = TO_NUMBER(TO_CHAR(TRUNC(SYSDATE),'YYYYMMDD'))";

        // Today rentals + revenue
        const rentalsToday = await conn.execute(
          `
          SELECT
            NVL(SUM(RENTALS_CNT),0) AS RENTALS_TODAY,
            NVL(SUM(REVENUE_TOTAL),0) AS REVENUE_TODAY
          FROM VW_KPI_RENTALS_DAILY
          ${where}
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Open alerts today
        const alertsOpen = await conn.execute(
          `
          SELECT NVL(SUM(OPEN_CNT),0) AS ALERTS_OPEN_TODAY
          FROM VW_KPI_ALERTS_DAILY
          ${where}
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        // Fleet snapshot today
        const fleet = await conn.execute(
          `
          SELECT
            NVL(SUM(FLEET_TOTAL),0) AS TOTAL,
            NVL(SUM(AVAILABLE_CNT),0) AS AVAILABLE,
            NVL(SUM(RENTED_CNT),0) AS RENTED,
            NVL(SUM(MAINTENANCE_CNT),0) AS MAINTENANCE
          FROM VW_KPI_BRANCH_UTILIZATION_DAILY
          ${where}
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const rowRentals = rentalsToday.rows?.[0] || {};
        const rowAlerts = alertsOpen.rows?.[0] || {};
        const rowFleet = fleet.rows?.[0] || {};

        return {
          today: {
            rentals: Number(rowRentals.RENTALS_TODAY || 0),
            revenueMAD: Number(rowRentals.REVENUE_TODAY || 0),
            alertsOpen: Number(rowAlerts.ALERTS_OPEN_TODAY || 0),
            activeRentalsNow: 0, // keep 0 in GOLD path; SILVER fallback provides accurate "now"
          },
          fleet: {
            total: Number(rowFleet.TOTAL || 0),
            available: Number(rowFleet.AVAILABLE || 0),
            rented: Number(rowFleet.RENTED || 0),
            maintenance: Number(rowFleet.MAINTENANCE || 0),
          },
          source: "GOLD",
        };
      },
      async (conn) => {
        // SILVER fallback
        const binds = {};
        let branchWhere = "";
        if (branchFilter) {
          branchWhere = " AND r.BRANCH_ID = :branchId";
          binds.branchId = branchId;
        }

        const todayRow = await conn.execute(
          `
          SELECT
            COUNT(*) AS RENTALS_TODAY,
            NVL(SUM(NVL(TOTAL_AMOUNT,0)),0) AS REVENUE_TODAY
          FROM SILVER_LAYER.RENTALS r
          WHERE TRUNC(CAST(r.START_AT AS DATE)) = TRUNC(SYSDATE)
          ${branchWhere}
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const activeNow = await conn.execute(
          `
          SELECT COUNT(*) AS ACTIVE_NOW
          FROM SILVER_LAYER.RENTALS r
          WHERE r.STATUS IN ('ACTIVE','IN_PROGRESS','ACTIVE_SIM')
            AND r.START_AT <= SYSTIMESTAMP
            AND NVL(r.RETURN_AT, r.DUE_AT) >= SYSTIMESTAMP
          ${branchWhere}
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const fleet = await conn.execute(
          `
          SELECT
            COUNT(*) AS TOTAL,
            SUM(CASE WHEN STATUS='AVAILABLE' THEN 1 ELSE 0 END) AS AVAILABLE,
            SUM(CASE WHEN STATUS='RENTED' THEN 1 ELSE 0 END) AS RENTED,
            SUM(CASE WHEN STATUS='MAINTENANCE' THEN 1 ELSE 0 END) AS MAINTENANCE
          FROM SILVER_LAYER.CARS
          ${branchFilter ? "WHERE BRANCH_ID = :branchId" : ""}
          `,
          branchFilter ? { branchId } : {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const alertsOpen = await conn.execute(
          `
          SELECT COUNT(*) AS ALERTS_OPEN
          FROM SILVER_LAYER.IOT_ALERTS
          WHERE STATUS='OPEN'
          ${branchFilter ? "AND BRANCH_ID = :branchId" : ""}
          `,
          branchFilter ? { branchId } : {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const t = todayRow.rows?.[0] || {};
        const a = activeNow.rows?.[0] || {};
        const f = fleet.rows?.[0] || {};
        const al = alertsOpen.rows?.[0] || {};

        return {
          today: {
            rentals: Number(t.RENTALS_TODAY || 0),
            revenueMAD: Number(t.REVENUE_TODAY || 0),
            alertsOpen: Number(al.ALERTS_OPEN || 0),
            activeRentalsNow: Number(a.ACTIVE_NOW || 0),
          },
          fleet: {
            total: Number(f.TOTAL || 0),
            available: Number(f.AVAILABLE || 0),
            rented: Number(f.RENTED || 0),
            maintenance: Number(f.MAINTENANCE || 0),
          },
          source: "SILVER",
        };
      }
    );

    return res.json(data);
  } catch (e) {
    console.error("ANALYTICS_OVERVIEW_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed to load dashboard overview" });
  }
});

/* =========================================================
   GET /api/v1/analytics/kpi/rentals-daily?days=14
========================================================= */
router.get("/kpi/rentals-daily", authMiddleware, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 14), 7), 90);
  try {
    const branchFilter = !isSupervisor(req);
    const branchId = branchFilter ? Number(requireBranch(req)) : null;

    const rows = await tryGoldThenSilver(
      async (conn) => {
        const binds = { days };
        let where = `WHERE dd.FULL_DATE >= TRUNC(SYSDATE) - :days`;
        if (branchFilter) {
          where += ` AND k.BRANCH_ID = :branchId`;
          binds.branchId = branchId;
        }

        const r = await conn.execute(
          `
          SELECT
            k.DATE_KEY,
            TO_CHAR(dd.FULL_DATE,'YYYY-MM-DD') AS FULL_DATE,
            NVL(k.RENTALS_CNT,0) AS VALUE
          FROM VW_KPI_RENTALS_DAILY k
          JOIN DIM_DATE dd ON dd.DATE_KEY = k.DATE_KEY
          ${where}
          ORDER BY k.DATE_KEY ASC
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return r.rows || [];
      },
      async (conn) => {
        const binds = { days };
        let extra = "";
        if (branchFilter) {
          extra = "AND r.BRANCH_ID = :branchId";
          binds.branchId = branchId;
        }

        const r = await conn.execute(
          `
          SELECT
            TO_NUMBER(TO_CHAR(TRUNC(CAST(r.START_AT AS DATE)),'YYYYMMDD')) AS DATE_KEY,
            TO_CHAR(TRUNC(CAST(r.START_AT AS DATE)),'YYYY-MM-DD') AS FULL_DATE,
            COUNT(*) AS VALUE
          FROM SILVER_LAYER.RENTALS r
          WHERE TRUNC(CAST(r.START_AT AS DATE)) >= TRUNC(SYSDATE) - :days
          ${extra}
          GROUP BY TRUNC(CAST(r.START_AT AS DATE))
          ORDER BY DATE_KEY ASC
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return r.rows || [];
      }
    );

    return res.json(rows);
  } catch (e) {
    console.error("ANALYTICS_RENTALS_DAILY_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed to load rentals daily" });
  }
});

/* =========================================================
   GET /api/v1/analytics/kpi/alerts-daily?days=14
========================================================= */
router.get("/kpi/alerts-daily", authMiddleware, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days || 14), 7), 90);
  try {
    const branchFilter = !isSupervisor(req);
    const branchId = branchFilter ? Number(requireBranch(req)) : null;

    const rows = await tryGoldThenSilver(
      async (conn) => {
        const binds = { days };
        let where = `WHERE d.FULL_DATE >= TRUNC(SYSDATE) - :days`;
        if (branchFilter) {
          where += ` AND fa.BRANCH_ID = :branchId`;
          binds.branchId = branchId;
        }

        const r = await conn.execute(
          `
          SELECT
            fa.DATE_KEY,
            TO_CHAR(d.FULL_DATE,'YYYY-MM-DD') AS FULL_DATE,
            COUNT(*) AS VALUE
          FROM FACT_IOT_ALERT fa
          JOIN DIM_DATE d ON d.DATE_KEY = fa.DATE_KEY
          ${where}
          GROUP BY fa.DATE_KEY, d.FULL_DATE
          ORDER BY fa.DATE_KEY ASC
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return r.rows || [];
      },
      async (conn) => {
        const binds = { days };
        let extra = "";
        if (branchFilter) {
          extra = "AND a.BRANCH_ID = :branchId";
          binds.branchId = branchId;
        }
        const r = await conn.execute(
          `
          SELECT
            TO_NUMBER(TO_CHAR(TRUNC(CAST(a.CREATED_AT AS DATE)),'YYYYMMDD')) AS DATE_KEY,
            TO_CHAR(TRUNC(CAST(a.CREATED_AT AS DATE)),'YYYY-MM-DD') AS FULL_DATE,
            COUNT(*) AS VALUE
          FROM SILVER_LAYER.IOT_ALERTS a
          WHERE TRUNC(CAST(a.CREATED_AT AS DATE)) >= TRUNC(SYSDATE) - :days
          ${extra}
          GROUP BY TRUNC(CAST(a.CREATED_AT AS DATE))
          ORDER BY DATE_KEY ASC
          `,
          binds,
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return r.rows || [];
      }
    );

    return res.json(rows);
  } catch (e) {
    console.error("ANALYTICS_ALERTS_DAILY_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed to load alerts daily" });
  }
});

module.exports = router;
