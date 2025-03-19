const axios = require('axios');
const { sendEmail } = require("../utils/emailSender");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Helper function to hash passwords
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Register User
const registerUser = async (req, res) => {
  const { email, password } = req.body;

  console.log("Received registration request for email:", email);

  try {
    const userExists = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (userExists) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = new User({
      email,
      password: hashedPassword,
    });

    await newUser.save();
    console.log("User registered successfully in MongoDB:", newUser);

    const jsonServerResponse = await axios.post('http://localhost:3000/users', {
      id: newUser._id.toString(),
      email,
      password: hashedPassword,
    });

    console.log("User registered successfully in JSON Server:", jsonServerResponse.data);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    if (newUser) {
      await User.deleteOne({ email });
      console.log("User deleted from MongoDB due to JSON Server error");
    }
    res.status(500).json({ message: "Failed to register user" });
  }
};

// Send OTP
const sendOTP = async (req, res) => {
  const { email } = req.body;

  console.log("Sending OTP to:", email);

  try {
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("User not found:", email);
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated OTP:", otp);

    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    console.log("OTP stored in MongoDB:", { otp, expiresAt: user.otpExpiry });

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

  console.log("Verifying OTP for:", email, "with OTP:", otp);

  try {
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("User not found:", email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found:", user);

    if (!user.otp || user.otp !== otp) {
      console.log("Invalid OTP for:", email, "Stored OTP:", user.otp);
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiry < Date.now()) {
      console.log("OTP expired for:", email);
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
      return res.status(400).json({ message: "OTP has expired" });
    }

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    console.log("Forgot Password Request for email:", email);

    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("User not found in database:", email);
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    console.log("OTP generated and stored in MongoDB:", otp);
    console.log("OTP expiry:", new Date(otpExpiry).toLocaleString());

    await sendEmail(
      email,
      "Password Reset Request",
      `Your password reset OTP is: ${otp}`
    );

    res.status(200).json({ message: "Reset OTP sent to your email" });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ message: "Failed to process forgot password request" });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  console.log("Reset Password Request:", { email, otp });

  try {
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("User not found in database:", email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found:", user);

    if (!user.otp || user.otp !== otp) {
      console.log("Invalid OTP for:", email, "Stored OTP:", user.otp);
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiry < Date.now()) {
      console.log("OTP has expired for:", email);
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
      return res.status(400).json({ message: "OTP has expired" });
    }

    const hashedPassword = await hashPassword(newPassword);
    console.log("New password hashed successfully");

    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    try {
      const jsonServerResponse = await axios.patch(`http://localhost:3000/users/${user._id}`, {
        password: hashedPassword,
        otp: null,
        otpExpiry: null,
      });

      console.log("Password updated successfully in JSON Server:", jsonServerResponse.data);
    } catch (jsonServerError) {
      console.error("Error updating password in JSON Server:", jsonServerError.response?.data || jsonServerError.message);
      throw jsonServerError;
    }

    console.log("Password reset successfully in MongoDB and JSON Server");

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in reset password:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};

// Login User
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    await sendEmail(
      email,
      "Login Successful",
      `You have successfully logged in.`
    );

    res.status(200).json({ message: "Login successful", user: { email: user.email } });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: "Failed to login" });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  forgotPassword,
  resetPassword,
  loginUser,
  registerUser,
};