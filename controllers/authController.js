const { sendEmail } = require("../utils/emailSender");
const bcrypt = require("bcryptjs"); // For password hashing
const User = require("../models/User"); // Import the User model

// In-memory storage for OTPs
const otpStorage = {};

// Helper function to hash passwords
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Register User
const registerUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user already exists (case-insensitive query)
    const userExists = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create a new user
    const newUser = new User({
      email,
      password: hashedPassword,
      resetToken: null, // Initialize resetToken as null
    });

    // Save the user to the database
    await newUser.save();

    console.log("User registered successfully:", newUser); // Log the new user
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
};

// Send OTP
const sendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Store OTP in memory with a 5-minute expiration
    otpStorage[email] = { otp, expiresAt: Date.now() + 300000 }; // 5 minutes
    console.log("OTP:", otp);

    // Send OTP via email
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

  try {
    const storedOTP = otpStorage[email];

    if (!storedOTP || storedOTP.otp != otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (storedOTP.expiresAt < Date.now()) {
      delete otpStorage[email]; // Clear expired OTP
      return res.status(400).json({ message: "OTP has expired" });
    }

    // OTP is valid
    delete otpStorage[email]; // Clear OTP after verification
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
    // Check if the user exists (case-insensitive query)
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a reset token (e.g., a random string or OTP)
    const resetToken = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

    // Save the reset token in the user object
    user.resetToken = resetToken;
    await user.save();

    // Send the reset token to the user's email
    await sendEmail(
      email,
      "Password Reset Request",
      `Your password reset OTP is: ${resetToken}`
    );

    res.status(200).json({ message: "Reset OTP sent to your email" });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ message: "Failed to process forgot password request" });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  console.log("Reset Password Request:", { email, resetToken });

  try {
    // Check if the user exists (case-insensitive query)
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });
    if (!user) {
      console.log("User not found in database:", email);
      return res.status(404).json({ message: "User not found" });
    }

    // Verify the reset token
    if (user.resetToken !== resetToken) {
      console.log("Invalid reset token for:", email);
      return res.status(400).json({ message: "Invalid reset token" });
    }

    // Hash the new password before saving
    const hashedPassword = await hashPassword(newPassword);

    // Update the password and clear the reset token
    user.password = hashedPassword;
    user.resetToken = null;
    await user.save();

    console.log("Password reset successfully for:", email);
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
    // Check if the user exists (case-insensitive query)
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Send a success message (do not send credentials)
    await sendEmail(email, "Login Successful", `You have successfully logged in.`);

    res.status(200).json({ message: "Login successful", user });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: "Failed to login" });
  }
};

module.exports = { sendOTP, verifyOTP, forgotPassword, resetPassword, loginUser, registerUser };