const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Public routes (for customers to pay)
router.get("/pay/:token", invoiceController.getInvoiceByToken);
router.post("/pay/:token", invoiceController.simulatePayment);

// Protected routes (for Admin Dashboard)
router.use(authMiddleware);
router.get("/", invoiceController.getInvoices);
router.get("/stats", invoiceController.getDashboardStats);

module.exports = router;
