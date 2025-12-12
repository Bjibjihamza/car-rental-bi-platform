const express = require("express");
const cors = require("cors");

const { initPool } = require("./db");
const carsRouter = require("./routes/cars");
const authRoutes = require("./routes/auth");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

app.get("/health", (req, res) => res.json({ status: "ok" }));

// routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cars", carsRouter);
app.use("/api/v1/branches", require("./routes/branches"));


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
