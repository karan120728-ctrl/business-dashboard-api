const express = require("express");
const router = express.Router();
const { getNotifications, markAsRead, clearAll } = require("../controllers/notification.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/", auth, getNotifications);
router.patch("/read-all", auth, markAsRead);
router.delete("/clear-all", auth, clearAll);

module.exports = router;
