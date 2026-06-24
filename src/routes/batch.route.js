const express = require("express");
const router = express.Router();
const { createBatch, getDriverBatches, getBatchDetails } = require("../controllers/batch.controller");
const auth = require("../middlewares/auth.middleware");

router.post("/", auth, createBatch);
router.get("/driver", auth, getDriverBatches);
router.get("/:id", auth, getBatchDetails);

module.exports = router;
