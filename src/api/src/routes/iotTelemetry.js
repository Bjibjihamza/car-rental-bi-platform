const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
// ✅ FIX: Import the missing middleware and helpers
const { authMiddleware } = require("../authMiddleware");
const { isSupervisor, requireBranch } = require("../access");

/**
 * GET /api/v1/iot-telemetry/live
 * Returns the latest telemetry points.
 * SCOPED: Managers only see cars from their branch.
 */
router.get("/live", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    // Base query: Join with CARS to get car info + branch info
    // We select from RT_IOT_FEED which is the "Live Buffer"
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

    // ✅ KEY CHANGE: If not supervisor, filter by Branch
    if (!isSupervisor(req)) {
      sql += ` WHERE c.BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    // Order by latest received
    sql += ` ORDER BY rt.RECEIVED_AT DESC`;

    // Limit for performance
    sql += ` FETCH FIRST 100 ROWS ONLY`;

    const result = await conn.execute(sql, binds);
    res.json(result.rows || []);

  } catch (e) {
    console.error("Live Feed Error:", e);
    res.status(500).json({ message: "Failed to fetch live feed" });
  } finally {
    try { if (conn) await conn.close(); } catch {}
  }
});

module.exports = router;