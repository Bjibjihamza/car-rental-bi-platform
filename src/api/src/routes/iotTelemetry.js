// src/api/src/routes/iotTelemetry.js
// ✅ FULL FILE — SILVER compatible (RT_IOT_FEED + CARS join + branch scoping)

const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

/**
 * GET /api/v1/iot-telemetry/live
 * - Reads from RT_IOT_FEED (live buffer)
 * - Joins CARS to expose MAKE/MODEL/PLATE
 * - SCOPED: Managers only see their branch
 */
router.get("/live", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    let sql = `
      SELECT
        rt.DEVICE_ID,
        rt.CAR_ID,
        c.MAKE,
        c.MODEL,
        c.LICENSE_PLATE,
        rt.SPEED_KMH,
        rt.FUEL_LEVEL_PCT,
        rt.ENGINE_TEMP_C,
        rt.EVENT_TYPE,
        rt.LATITUDE,
        rt.LONGITUDE,
        rt.RECEIVED_AT
      FROM RT_IOT_FEED rt
      JOIN CARS c ON rt.CAR_ID = c.CAR_ID
    `;

    const binds = {};
    if (!isSupervisor(req)) {
      sql += ` WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = Number(requireBranch(req));
    }

    sql += ` ORDER BY rt.RECEIVED_AT DESC FETCH FIRST 150 ROWS ONLY`;

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json(result.rows || []);
  } catch (e) {
    console.error("IOT_TELEMETRY_LIVE_ERROR:", e);
    return res.status(500).json({ message: e.message || "Failed to fetch live feed" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
