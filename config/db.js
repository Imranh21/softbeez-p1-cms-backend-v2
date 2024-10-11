const mongoose = require("mongoose");
const http = require("http");
const https = require("https");

const PING_INTERVAL = 10 * 60 * 1000;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const keepAlive = () => {
      const APP_URL =
        process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
      const request = APP_URL.startsWith("https") ? https : http;

      const req = request.get(`${APP_URL}/ping`, (res) => {
        if (res.statusCode === 200) {
          console.log("Keep-alive ping successful");
        } else {
          console.log("Keep-alive ping failed, status code:", res.statusCode);
        }
      });

      req.on("error", (error) => {
        console.error("Keep-alive ping failed:", error);
      });
    };

    setInterval(keepAlive, PING_INTERVAL);
    console.log("Keep-alive mechanism started (pinging every 2 minutes)");
  } catch (error) {
    console.log(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
