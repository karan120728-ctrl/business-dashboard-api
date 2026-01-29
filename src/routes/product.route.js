const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const isAdmin=require("../middlewares/isAdmin.middleware")
const {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  restoreProduct
} = require("../controllers/product.controller");

// Create product (logged-in users)
router.post("/", auth, createProduct);

// Get products (logged-in users)
router.get("/", auth, getProducts);

// get product by id
router.get("/:id", auth, getProducts);

// update product
router.put("/:id", auth, updateProduct);

// soft delete the product
router.delete("/:id", auth, deleteProduct);

// restore product
router.patch("/:id/restore", auth, isAdmin, restoreProduct);


module.exports = router;
