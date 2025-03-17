const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Replace the connection string with your MongoDB URI
    const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/taras_portal", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit the process if the connection fails
  }
};

module.exports = connectDB;