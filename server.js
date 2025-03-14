require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRoutes = require("./Routes/authRoutes");


const app = express();
const PORT = 4000;

// Middleware
app.use(cors({ origin: "http://localhost:3001" })); // Allow requests from frontend
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use("/api/auth", authRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});