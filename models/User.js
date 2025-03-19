const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetToken: { type: String}, // Store reset token
  resetTokenExpiry: { type: Date, default: null }, // Store reset token expiry
});
const User = mongoose.model("User", userSchema);

module.exports = User;