const express = require("express");
const cors = require("cors");
const { initPool } = require("./db");

// --- Route Imports ---
const authRoutes = require("./routes/auth");
const carsRouter = require("./routes/cars");
const branchesRouter = require("./routes/branches");
const devicesRouter = require("./routes/devices");
const rentalsRouter = require("./routes/rentals");
const customersRouter = require("./routes/customers");
const managersRouter = require("./routes/managers");
const iotAlertsRouter = require("./routes/iotAlerts");
const iotTelemetryRouter = require("./routes/iotTelemetry");
const categoriesRouter = require("./routes/categories"); // [NEW]

const app = express();
app.use(express.json());

// --- Middleware ---
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

app.get("/health", (req, res) => res.json({ status: "ok" }));

// --- Mount Routes ---
// The path here is the "prefix". The router files handle the rest.
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cars", carsRouter);
app.use("/api/v1/branches", branchesRouter);
app.use("/api/v1/devices", devicesRouter);
app.use("/api/v1/rentals", rentalsRouter);
app.use("/api/v1/customers", customersRouter);
app.use("/api/v1/managers", managersRouter);
app.use("/api/v1/iot-alerts", iotAlertsRouter);
app.use("/api/v1/iot-telemetry", iotTelemetryRouter);
app.use("/api/v1/categories", categoriesRouter); // [NEW]

const PORT = process.env.PORT || 8000;

(async () => {
  try {
    await initPool();
    app.listen(PORT, "0.0.0.0", () => console.log(`🚀 API running on :${PORT}`));
  } catch (e) {
    console.error("❌ Failed to start API:", e);
    process.exit(1);
  }
})();