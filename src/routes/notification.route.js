const express = require("express");
const router = express.Router();
const { getNotifications, markAsRead } = require("../controllers/notification.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/", auth, getNotifications);
router.patch("/read-all", auth, markAsRead);

module.exports = router;
