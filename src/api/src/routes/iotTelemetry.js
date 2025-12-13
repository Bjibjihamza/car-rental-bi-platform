const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json([]); // placeholder until you implement telemetry
});

module.exports = router;
