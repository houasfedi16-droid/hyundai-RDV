require("./config/db");

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const userRoutes = require("./routes/userRoutes");
const otpRoutes = require("./routes/otpRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const registerRoutes = require("./routes/registerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const { catalogRouter } = require("./routes/catalogRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", registerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api", catalogRouter);

app.get("/", (req, res) => {
  res.send("Hyundai RDV API is running");
});

app.use((req, res) => {
  res.status(404).send("Route not found");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
