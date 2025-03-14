const { sendEmail } = require("../utils/emailSender");

// In-memory storage for OTPs (replace with a database in production)
const otpStorage = {};

// Send OTP
const sendOTP = async (req, res) => {
  const { email } = req.body;

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  // Store OTP in memory
  otpStorage[email] = otp;

  // Send OTP via email
  try {
    await sendEmail(email, "Your OTP for Verification", `Your OTP is: ${otp}`);
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (otpStorage[email] && otpStorage[email] == otp) {
    // OTP is valid
    delete otpStorage[email]; // Clear OTP after verification
    res.status(200).json({ message: "OTP verified successfully" });
  } else {
    // OTP is invalid
    res.status(400).json({ message: "Invalid OTP" });
  }
};

module.exports = { sendOTP, verifyOTP };