const express = require("express");
const router = express.Router();

const { getDashboardData } = require("../controllers/dashboard.controller");

router.get("/dashboard", getDashboardData);

module.exports = router;