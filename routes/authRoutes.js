const express = require("express");
const router = express.Router();
const { sendOTP, verifyOTP, forgotPassword, resetPassword, registerUser} = require("../controllers/authController");
const { loginUser } = require("../controllers/authController");

// Send OTP
router.post("/send-otp", sendOTP);

// Verify OTP
router.post("/verify-otp", verifyOTP);

// Forgot Password
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/loginuser", loginUser);
router.post("/register", registerUser);

module.exports = router;