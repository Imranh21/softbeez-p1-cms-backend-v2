require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const businessRoutes = require("./routes/businessRoutes");
const customerRoutes = require("./routes/customerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const businessOverviewRoutes = require("./routes/businessOverviewRoutes");
const { spinServer } = require("./controllers/spinServer");

const app = express();

connectDB();

// Middleware
app.use(
  cors({
    origin: "https://softbeez-p1-cms-frontend-v2.vercel.app/",
    methods: "GET,POST,PUT,DELETE",
  })
);
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ping", spinServer);
app.use("/api/businesses", businessRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard/business-overview", businessOverviewRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
