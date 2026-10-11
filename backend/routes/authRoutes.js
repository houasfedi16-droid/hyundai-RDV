const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

// TEST ROUTE
router.get("/", (req, res) => {
  res.send("Auth route working with Keycloak");
});

// ❌ OLD REGISTER DISABLED
router.post("/register-old", (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Old MySQL registration is disabled. Use Keycloak register route.",
  });
});

// ❌ OLD LOGIN DISABLED
router.post("/login-old", (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Old MySQL login is disabled. Use Keycloak login.",
  });
});

// PROFILE USING KEYCLOAK TOKEN
router.get("/profile", protect, (req, res) => {
  res.json({
    success: true,
    message: "Protected profile accessed",
    user: req.user,
  });
});

module.exports = router;