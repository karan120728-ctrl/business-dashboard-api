const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");

const { getDashboardData } = require("../controllers/dashboard.controller");

router.get("/dashboard", auth, getDashboardData);

module.exports = router;