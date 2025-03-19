const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  otp: { type: String }, // Store OTP for verification
  otpExpiry: { type: Date, default: null }, // Store OTP expiry
});

const User = mongoose.model("User", userSchema);

module.exports = User;