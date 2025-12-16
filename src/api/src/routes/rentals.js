// src/api/src/routes/rentals.js

const express = require("express");
const router = express.Router();
const oracledb = require("oracledb");
const { getConnection } = require("../db");
const { authMiddleware } = require("../authMiddleware");
const {
  isSupervisor,
  requireManager,
  requireManagerId,
  requireBranch,
} = require("../access");

function requireBody(res, body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === "") {
      res.status(400).json({ message: `Missing field: ${f}` });
      return false;
    }
  }
  return true;
}

/* ================= HELPERS FOR REPORT ================= */

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickRow(row, key, idx) {
  if (!row) return null;
  if (typeof row === "object" && !Array.isArray(row)) return row[key];
  return row[idx];
}

function downsample(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  return out;
}

function buildReport(telemetry, options = {}) {
  const SPEEDING_KMH = options.SPEEDING_KMH ?? 120;
  const HARSH_BRAKE_BAR = options.HARSH_BRAKE_BAR ?? 65;
  const HARSH_ACCEL_MS2 = options.HARSH_ACCEL_MS2 ?? 3.5;
  const OVERHEAT_C = options.OVERHEAT_C ?? 110;

  let maxSpeed = 0;
  let sumSpeed = 0;
  let speedCount = 0;

  let speedingCount = 0;
  let harshBrakeCount = 0;
  let harshAccelCount = 0;
  let overheatCount = 0;

  let idleEvents = 0;
  let drivingEvents = 0;

  let minFuel = null;
  let maxFuel = null;
  let endFuel = null;

  let firstOdo = null;
  let lastOdo = null;

  let gpsDistanceKm = 0;
  let prevGps = null;

  const routePoints = [];

  for (const t of telemetry) {
    const sp = safeNum(t.SPEED_KMH);
    if (sp != null) {
      maxSpeed = Math.max(maxSpeed, sp);
      sumSpeed += sp;
      speedCount += 1;
      if (sp > SPEEDING_KMH) speedingCount += 1;
    }

    const br = safeNum(t.BRAKE_PRESSURE_BAR);
    if (br != null && br > HARSH_BRAKE_BAR) harshBrakeCount += 1;

    const ac = safeNum(t.ACCELERATION_MS2);
    if (ac != null && ac > HARSH_ACCEL_MS2) harshAccelCount += 1;

    const tmp = safeNum(t.ENGINE_TEMP_C);
    if (tmp != null && tmp > OVERHEAT_C) overheatCount += 1;

    const fuel = safeNum(t.FUEL_LEVEL_PCT);
    if (fuel != null) {
      minFuel = minFuel == null ? fuel : Math.min(minFuel, fuel);
      maxFuel = maxFuel == null ? fuel : Math.max(maxFuel, fuel);
      endFuel = fuel;
    }

    const odo = safeNum(t.ODOMETER_KM);
    if (odo != null) {
      if (firstOdo == null) firstOdo = odo;
      lastOdo = odo;
    }

    const ev = String(t.EVENT_TYPE || "").toUpperCase();
    if (ev === "IDLE") idleEvents += 1;
    if (ev === "DRIVING") drivingEvents += 1;

    const lat = safeNum(t.LATITUDE);
    const lng = safeNum(t.LONGITUDE);
    if (lat != null && lng != null) {
      routePoints.push({
        ts: t.RECEIVED_AT,
        lat,
        lng,
        speed: sp,
        event: ev,
      });

      if (prevGps) {
        gpsDistanceKm += haversineKm(prevGps.lat, prevGps.lng, lat, lng);
      }
      prevGps = { lat, lng };
    }
  }

  const avgSpeed = speedCount ? sumSpeed / speedCount : 0;

  const distanceKm =
    firstOdo != null && lastOdo != null
      ? Math.max(0, lastOdo - firstOdo)
      : routePoints.length > 1
      ? gpsDistanceKm
      : null;

  return {
    metrics: {
      avgSpeed,
      maxSpeed,
      distanceKm,
      speedingCount,
      harshBrakeCount,
      harshAccelCount,
      overheatCount,
      idleEvents,
      drivingEvents,
      fuel: { min: minFuel, max: maxFuel, end: endFuel },
    },
    routePoints,
  };
}
// ✅ FULL ROUTE: GET /api/v1/rentals/:id/report
router.get("/:id/report", authMiddleware, async (req, res) => {
  const rentalId = Number(req.params.id);
  const sample = Math.min(Math.max(Number(req.query.sample || 80), 10), 300);

  let conn;
  try {
    conn = await getConnection();

    const binds = { id: rentalId };

    // 1) Load rental + car info
    let rentalSql = `
      SELECT
        r.RENTAL_ID,
        r.CAR_ID,
        r.BRANCH_ID,
        r.START_AT,
        NVL(r.RETURN_AT, r.DUE_AT) AS END_AT,
        c.LICENSE_PLATE,
        c.MAKE,
        c.MODEL
      FROM RENTALS r
      JOIN CARS c ON c.CAR_ID = r.CAR_ID
      WHERE r.RENTAL_ID = :id
    `;

    if (!isSupervisor(req)) {
      rentalSql += ` AND r.BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    const rentalR = await conn.execute(rentalSql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    const row = rentalR.rows?.[0];
    if (!row) return res.status(404).json({ message: "Rental not found" });

    const RENTAL_ID = Number(row.RENTAL_ID);
    const CAR_ID = Number(row.CAR_ID);
    const BRANCH_ID = Number(row.BRANCH_ID);
    const START_AT = row.START_AT;
    const END_AT = row.END_AT;
    const LICENSE_PLATE = row.LICENSE_PLATE;
    const MAKE = row.MAKE;
    const MODEL = row.MODEL;

    // 2) Telemetry for THIS rental only (strict)
    // ✅ Primary: RT_IOT_FEED tagged with real RENTAL_ID (from streamer)
    let telemetry = [];

    const rtSql = `
      SELECT
        rt.RECEIVED_AT,
        rt.DEVICE_ID,
        rt.CAR_ID,
        rt.EVENT_TYPE,
        rt.SPEED_KMH,
        rt.FUEL_LEVEL_PCT,
        rt.ENGINE_TEMP_C,
        rt.LATITUDE,
        rt.LONGITUDE,
        rt.ODOMETER_KM,
        rt.ACCELERATION_MS2,
        rt.BRAKE_PRESSURE_BAR
      FROM RT_IOT_FEED rt
      WHERE rt.RENTAL_ID = :rid
      ORDER BY rt.RECEIVED_AT ASC
    `;

    const rtR = await conn.execute(
      rtSql,
      { rid: RENTAL_ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    telemetry = rtR.rows || [];

    // ✅ Fallback: if streamer didn't tag RT_IOT_FEED.RENTAL_ID yet
    // Use historical IOT_TELEMETRY within rental window (CAR_ID + time range)
    if (!telemetry.length) {
      const histSql = `
        SELECT
          EVENT_TS AS RECEIVED_AT,
          DEVICE_ID,
          CAR_ID,
          EVENT_TYPE,
          SPEED_KMH,
          FUEL_LEVEL_PCT,
          ENGINE_TEMP_C,
          LATITUDE,
          LONGITUDE,
          ODOMETER_KM,
          ACCELERATION_MS2,
          BRAKE_PRESSURE_BAR
        FROM IOT_TELEMETRY
        WHERE CAR_ID = :carId
          AND EVENT_TS >= :startAt
          AND EVENT_TS <= :endAt
        ORDER BY EVENT_TS ASC
      `;

      const histR = await conn.execute(
        histSql,
        { carId: CAR_ID, startAt: START_AT, endAt: END_AT },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      telemetry = histR.rows || [];
    }

    // 3) Build report metrics + route (your existing logic)
    const { metrics, routePoints } = buildReport(telemetry, {
      SPEEDING_KMH: 120,
      HARSH_BRAKE_BAR: 65,
      HARSH_ACCEL_MS2: 3.5,
      OVERHEAT_C: 110,
    });

    const route = downsample(routePoints, sample);

    // 4) Response (shape expected by RentalReportPage)
    res.json({
      rental: {
        RENTAL_ID,
        CAR_ID,
        BRANCH_ID,
        LICENSE_PLATE,
        MAKE,
        MODEL,
        START_AT,
        END_AT,
        telemetryPoints: telemetry.length,
        simRentalId: null, // ✅ no more sim id trick
      },
      metrics,
      route,
    });
  } catch (e) {
    console.error("RENTAL_REPORT_ERROR:", e);
    res.status(500).json({ message: e.message || "Failed to build report" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

/* ================= ROUTES ================= */

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
        b.CITY AS BRANCH_CITY,
        c.LICENSE_PLATE,
        c.MAKE,
        c.MODEL,
        cu.FIRST_NAME AS CUSTOMER_FIRST_NAME,
        cu.LAST_NAME  AS CUSTOMER_LAST_NAME,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM RT_IOT_FEED rt
            WHERE rt.CAR_ID = r.CAR_ID
              AND rt.RECEIVED_AT > SYSTIMESTAMP - INTERVAL '2' MINUTE
          ) THEN 1
          ELSE 0
        END AS IS_DRIVING
      FROM RENTALS r
      JOIN BRANCHES b   ON b.BRANCH_ID = r.BRANCH_ID
      JOIN CARS c       ON c.CAR_ID = r.CAR_ID
      JOIN CUSTOMERS cu ON cu.CUSTOMER_ID = r.CUSTOMER_ID
    `;

    if (!isSupervisor(req)) {
      sql += ` WHERE r.BRANCH_ID = :branchId`;
      binds.branchId = requireBranch(req);
    }

    sql += ` ORDER BY r.RENTAL_ID DESC`;

    const r = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    res.json(r.rows || []);
  } catch (e) {
    console.error("RENTALS_GET_ERROR:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Failed to fetch rentals" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

/**
 * POST /api/v1/rentals
 * - only MANAGER can create
 * - uses manager branch + managerId from token
 */
router.post("/", authMiddleware, async (req, res) => {
  const body = req.body || {};
  const ok = requireBody(res, body, ["CAR_ID", "CUSTOMER_ID", "START_AT", "DUE_AT"]);
  if (!ok) return;

  let conn;
  try {
    requireManager(req);

    conn = await getConnection();

    const branchId = requireBranch(req);
    const managerId = requireManagerId(req);

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
        managerId: Number(managerId),
        startAt: String(body.START_AT),
        dueAt: String(body.DUE_AT),
        status: String(body.STATUS || "ACTIVE").toUpperCase(),
        startOdo: body.START_ODOMETER != null ? Number(body.START_ODOMETER) : null,
        totalAmount: body.TOTAL_AMOUNT != null ? Number(body.TOTAL_AMOUNT) : null,
        currency: String(body.CURRENCY || "MAD").toUpperCase(),
        outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    await conn.execute(
      `UPDATE CARS SET STATUS = 'RENTED' WHERE CAR_ID = :id`,
      { id: Number(body.CAR_ID) },
      { autoCommit: true }
    );

    res.status(201).json({ RENTAL_ID: result.outBinds.outId[0] });
  } catch (e) {
    console.error("RENTALS_POST_ERROR:", e);
    res
      .status(e.status || 500)
      .json({ message: e.message || "Failed to create rental" });
  } finally {
    try {
      if (conn) await conn.close();
    } catch {}
  }
});

module.exports = router;
