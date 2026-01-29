const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const isAdmin = require("../middlewares/isAdmin.middleware")
const { createOrder, getOrders, updateOrderStatus, getSalesSummary, getMonthlySales } = require("../controllers/order.controller");

router.post("/", auth, createOrder);
router.get("/", auth, getOrders);
router.patch("/:id/status", auth, isAdmin, updateOrderStatus);
router.get("/reports/summary", auth, isAdmin, getSalesSummary);
router.get("/reports/monthly", auth, isAdmin, getMonthlySales);





module.exports = router;
