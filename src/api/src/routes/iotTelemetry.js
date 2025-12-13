const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");

// ... existing routes ...

// GET /api/v1/iot-telemetry/live
// Fetches the most recent signals received in the last minute
router.get("/live", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    
    // Get data received in the live buffer in the last 60 seconds
    const sql = `
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
      ORDER BY rt.RECEIVED_AT DESC
      FETCH FIRST 20 ROWS ONLY
    `;
    
    const result = await conn.execute(sql);
    res.json(result.rows || []);
  } catch (err) {
    console.error("Live Feed Error:", err);
    res.status(500).json({ message: "Failed to fetch live feed" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) {}
    }
  }
});

module.exports = router;