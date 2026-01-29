const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");

const {
  createCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
  restoreCustomer
} = require("../controllers/customer.controller");

router.post("/", auth, createCustomer);
router.get("/", auth, getCustomers);
router.put("/:id", auth, updateCustomer);
router.delete("/:id", auth, deleteCustomer);
router.patch("/restore/:id", auth, restoreCustomer);


module.exports = router;
