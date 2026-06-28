const express = require("express");
const router = express.Router();

const { createUser, getUser, loginUser, updateUser, forgotPassword, resetPassword, updatePushToken, regenerateCode, deleteUser } = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const roleCheck = require("../middlewares/role.middleware");

// Create new user
router.post("/createUser", createUser);

// Get all users
router.get("/", auth, getUser);

// Update user (Role/Active status)
router.patch("/:id", auth, updateUser);

// Delete User
router.delete("/:id", auth, deleteUser);

// Regenerate Business Code
router.post("/business/regenerate-code", auth, regenerateCode);

// Register Push Token
router.post("/push-token", auth, updatePushToken);

// LOGIN USER
router.post("/login", loginUser);

// Password Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/admin-only", auth, roleCheck("admin"), (req, res) => {
  res.json({ message: "Welcome Admin" });
});

module.exports = router;
