const express = require("express");
const router = express.Router();

const { createUser, getUser, loginUser, updateUser } = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const roleCheck = require("../middlewares/role.middleware");

// Create new user
router.post("/createUser", createUser);

// Get all users
router.get("/getUser", auth, getUser);

// Update user (Role/Active status)
router.patch("/:id", auth, updateUser);

// LOGIN USER
router.post("/login", loginUser);

router.get("/admin-only", auth, roleCheck("admin"), (req, res) => {
  res.json({ message: "Welcome Admin" });
});

module.exports = router;
