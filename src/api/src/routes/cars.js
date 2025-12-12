// src/routes/cars.js
const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const oracledb = require("oracledb");

// GET /api/v1/cars?status=AVAILABLE&branch_id=6
router.get("/", async (req, res) => {
  const { status, branch_id } = req.query;

  let conn;
  try {
    conn = await getConnection();

    const where = [];
    const binds = {};

    if (status) {
      where.push("c.STATUS = :status");
      binds.status = status;
    }
    if (branch_id) {
      where.push("c.BRANCH_ID = :branch_id");
      binds.branch_id = Number(branch_id);
    }

    const sql = `
      SELECT
        c.CAR_ID        AS car_id,
        c.CATEGORY_ID   AS category_id,
        c.DEVICE_ID     AS device_id,
        c.VIN           AS vin,
        c.LICENSE_PLATE AS license_plate,
        c.MAKE          AS make,
        c.MODEL         AS model,
        c.MODEL_YEAR    AS model_year,
        c.COLOR         AS color,
        c.ODOMETER_KM   AS odometer_km,
        c.STATUS        AS status,
        c.BRANCH_ID     AS branch_id,
        c.CREATED_AT    AS created_at,
        b.CITY          AS branch_city
      FROM RAW_LAYER.CARS c
      LEFT JOIN RAW_LAYER.BRANCHES b ON b.BRANCH_ID = c.BRANCH_ID
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.CAR_ID DESC
    `;

    const result = await conn.execute(sql, binds);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Internal server error" });
  } finally {
    if (conn) await conn.close();
  }
});

// GET /api/v1/cars/:car_id
router.get("/:car_id", async (req, res) => {
  const carId = Number(req.params.car_id);
  let conn;
  try {
    conn = await getConnection();

    const sql = `
      SELECT
        c.CAR_ID AS car_id, c.CATEGORY_ID AS category_id, c.DEVICE_ID AS device_id,
        c.VIN AS vin, c.LICENSE_PLATE AS license_plate, c.MAKE AS make, c.MODEL AS model,
        c.MODEL_YEAR AS model_year, c.COLOR AS color, c.ODOMETER_KM AS odometer_km,
        c.STATUS AS status, c.BRANCH_ID AS branch_id, c.CREATED_AT AS created_at,
        b.CITY AS branch_city
      FROM RAW_LAYER.CARS c
      LEFT JOIN RAW_LAYER.BRANCHES b ON b.BRANCH_ID = c.BRANCH_ID
      WHERE c.CAR_ID = :id
    `;

    const r = await conn.execute(sql, { id: carId });
    if (!r.rows.length) return res.status(404).json({ detail: "Car not found" });

    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Internal server error" });
  } finally {
    if (conn) await conn.close();
  }
});

// POST /api/v1/cars
router.post("/", async (req, res) => {
  const p = req.body;
  let conn;
  try {
    conn = await getConnection();

    const sql = `
      INSERT INTO RAW_LAYER.CARS (
        CATEGORY_ID, DEVICE_ID, VIN, LICENSE_PLATE, MAKE, MODEL,
        MODEL_YEAR, COLOR, ODOMETER_KM, STATUS, BRANCH_ID
      ) VALUES (
        :category_id, :device_id, :vin, :license_plate, :make, :model,
        :model_year, :color, :odometer_km, :status, :branch_id
      )
      RETURNING CAR_ID INTO :car_id
    `;

    const binds = {
      category_id: p.category_id,
      device_id: p.device_id ?? null,
      vin: p.vin,
      license_plate: p.license_plate,
      make: p.make,
      model: p.model,
      model_year: p.model_year ?? null,
      color: p.color ?? null,
      odometer_km: p.odometer_km ?? 0,
      status: p.status ?? "AVAILABLE",
      branch_id: p.branch_id ?? null,
      car_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const result = await conn.execute(sql, binds, { autoCommit: true });
    const newId = result.outBinds.car_id[0];

    res.status(201).json({ car_id: newId, ...p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: "Internal server error" });
  } finally {
    if (conn) await conn.close();
  }
});

module.exports = router;
