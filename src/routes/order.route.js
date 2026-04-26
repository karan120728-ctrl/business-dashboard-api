const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/isAdmin.middleware");
const { upload } = require("../middlewares/upload.middleware");
const {
    createOrder,
    getOrders,
    getOrderLocation,
    updateOrderStatus,
    assignDriver,
    updateLocation,
    submitProof
} = require("../controllers/order.controller");

router.post("/", auth, createOrder);
router.get("/", auth, getOrders);
router.get("/:id/location", auth, getOrderLocation);          // Live location polling
router.patch("/:id/status", auth, isAdmin, updateOrderStatus);
router.post("/:id/assign-driver", auth, isAdmin, assignDriver);
router.post("/:id/update-location", auth, updateLocation);    // GPS auto-push
router.post("/:id/submit-proof", auth, upload.single('proof_image'), submitProof); // Camera upload

module.exports = router;
