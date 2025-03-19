const mongoose = require("mongoose");

const connectDB = async () => {
  mongoose.set("debug", true); // Enable Mongoose debug mode

  try {
    const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/taras_portal_users"; // Replace with your MongoDB URI
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;