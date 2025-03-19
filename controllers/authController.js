const axios = require('axios'); // For making HTTP requests to JSON Server
const { sendEmail } = require("../utils/emailSender");
const bcrypt = require("bcryptjs"); // For password hashing
const User = require("../models/User"); // Import the User model

// In-memory storage for OTPs
const otpStorage = {};

// In-memory storage for reset tokens
const resetTokenStorage = {};

// Helper function to hash passwords
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Register User
const registerUser = async (req, res) => {
  const { email, password } = req.body;

  console.log("Received registration request for email:", email); // Log the email

  try {
    // Check if the user already exists in MongoDB (case-insensitive query)
    const userExists = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (userExists) {
      console.log("User already exists:", email); // Log if user exists
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create a new user in MongoDB
    const newUser = new User({
      email,
      password: hashedPassword,
    });

    // Save the user to MongoDB
    await newUser.save();
    console.log("User registered successfully in MongoDB:", newUser);

    // Save the user to JSON Server (db.json)
    const jsonServerResponse = await axios.post('http://localhost:3000/users', {
      email,
      password: hashedPassword, // Store the hashed password in db.json
    });

    console.log("User registered successfully in JSON Server:", jsonServerResponse.data);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);

    // If saving to JSON Server fails, delete the user from MongoDB to maintain consistency
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

  console.log("Sending OTP to:", email); // Log the email

  try {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log("Generated OTP:", otp); // Log the OTP

    // Store OTP in memory with a 5-minute expiration
    otpStorage[email] = { otp, expiresAt: Date.now() + 300000 }; // 5 minutes
    console.log("OTP stored in memory:", otpStorage[email]); // Log the stored OTP

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
    console.log("Forgot Password Request for email:", email);

    // Check if the user exists in MongoDB (case-insensitive query)
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("User not found in database:", email);
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a reset token (e.g., a random string or OTP)
    const resetToken = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    const resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // // Store the reset token in memory
    // resetTokenStorage[email] = {
    //   resetToken,
    //   resetTokenExpiry,
    // };
      // Save the reset token and expiry in MongoDB
      user.resetToken = resetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();

    console.log("Reset token generated and stored in memory:", resetToken);
    console.log("Reset token expiry:", new Date(resetTokenExpiry).toLocaleString());

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
    console.log("Reset Password Request for email:", email);

    // Check if the user exists in MongoDB (case-insensitive query)
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      console.log("User not found in database:", email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found:", user);

    // Verify the reset token
    if (!user.resetToken || user.resetToken !== resetToken) {
      console.log("Invalid reset token for:", email);
      return res.status(400).json({ message: "Invalid reset token" });
    }

    // Check if the reset token has expired
    if (user.resetTokenExpiry < Date.now()) {
      console.log("Reset token has expired for:", email);
      return res.status(400).json({ message: "Reset token has expired" });
    }

    // Hash the new password before saving
    const hashedPassword = await hashPassword(newPassword);
    console.log("New password hashed successfully");

    // Update the password and clear the reset token in MongoDB
    user.password = hashedPassword;
    user.resetToken = null; // Clear the resetToken
    user.resetTokenExpiry = null; // Clear the resetTokenExpiry
    await user.save();

    // Update the password in JSON Server
    try {
      const jsonServerResponse = await axios.patch(`http://localhost:3000/users/${user.id}`, {
        password: hashedPassword,
        resetToken: null, // Clear the resetToken in JSON Server
        resetTokenExpiry: null, // Clear the resetTokenExpiry in JSON Server
      });

      console.log("Password updated successfully in JSON Server:", jsonServerResponse.data);
    } catch (jsonServerError) {
      console.error("Error updating password in JSON Server:", jsonServerError.response?.data || jsonServerError.message);
      throw jsonServerError; // Re-throw the error to trigger the catch block
    }

    console.log("Password reset successfully in MongoDB and JSON Server");

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in reset password:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};


// const resetPassword = async (req, res) => {
//   const { email, resetToken, newPassword } = req.body;
//   console.log("Reset Password Request:", { email, resetToken });

//   try {
//     console.log("Reset Password Request for email:", email);

//     // Check if the user exists in MongoDB (case-insensitive query)
//     const user = await User.findOne({
//       email: { $regex: new RegExp(`^${email}$`, "i") },
//     });

//     if (!user) {
//       console.log("User not found in database:", email);
//       return res.status(404).json({ message: "User not found" });
//     }

//     console.log("User found:", user);

//     // // Verify the reset token from in-memory storage
//     // const storedTokenData = resetTokenStorage[email];

//       // Verify the reset token
//       if (!user.resetToken || user.resetToken !== resetToken) {
//         console.log("Invalid reset token for:", email);
//         return res.status(400).json({ message: "Invalid reset token" });
//       }



//     if (!storedTokenData) {
//       console.log("No reset token found for:", email);
//       return res.status(400).json({ message: "Invalid reset token" });
//     }

//     console.log("Stored reset token data:", storedTokenData);

//     if (storedTokenData.resetToken !== resetToken) {
//       console.log("Invalid reset token for:", email);
//       return res.status(400).json({ message: "Invalid reset token" });
//     }

//     // Check if the reset token has expired
//     if (storedTokenData.resetTokenExpiry < Date.now()) {
//       console.log("Reset token has expired for:", email);
//       return res.status(400).json({ message: "Reset token has expired" });
//     }

//     // Hash the new password before saving
//     const hashedPassword = await hashPassword(newPassword);
//     console.log("New password hashed successfully");

//     // Update the password in MongoDB
//     user.password = hashedPassword;
//     await user.save();
//     console.log("Password updated successfully in MongoDB");

//     // Update the password in JSON Server
//     try {
//       const jsonServerResponse = await axios.patch(`http://localhost:3000/users/${user.id}`, {
//         password: hashedPassword,
//       });

//       console.log("Password updated successfully in JSON Server:", jsonServerResponse.data);
//     } catch (jsonServerError) {
//       console.error("Error updating password in JSON Server:", jsonServerError.response?.data || jsonServerError.message);
//       throw jsonServerError; // Re-throw the error to trigger the catch block
//     }

//     // Clear the reset token from memory
//     delete resetTokenStorage[email];
//     console.log("Reset token cleared from memory for:", email);

//     res.status(200).json({ message: "Password reset successfully" });
//   } catch (error) {
//     console.error("Error in reset password:", error);
//     res.status(500).json({ message: "Failed to reset password" });
//   }
// };

// Login User
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists in MongoDB (case-insensitive query)
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Send a success message (do not send credentials)
    await sendEmail(
      email,
      "Login Successful",
      `You have successfully logged in.`
    );

    res.status(200).json({ message: "Login successful", user });
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