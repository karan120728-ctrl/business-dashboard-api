require("dotenv").config();
const express = require("express");
const path = require("path");
const { connectDB } = require("./db/connection");
const initDB = require("./db/init");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

// Serve uploaded proof images as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// connect DB and initialize tables
connectDB().then(() => {
  initDB();
});

// Socket.io Connection
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  
  socket.on("join", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their notification room.`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Export IO to use in controllers
app.set("io", io);

// test route
app.get("/", (req, res) => {
  res.send("Business Dashboard API with Real-time Notifications is running");
});

// Routes
const userRoute = require("./routes/user.route");
app.use("/api/users", userRoute);

const customerRoutes = require("./routes/customer.route");
app.use("/api/customer", customerRoutes);

const productRoute = require("./routes/product.route");
app.use("/api/products", productRoute);

const orderRoute = require("./routes/order.route");
app.use("/api/orders", orderRoute);

const notificationRoute = require("./routes/notification.route");
app.use("/api/notifications", notificationRoute);

const dashboardRoute = require("./routes/dashboard.route");
app.use("/api", dashboardRoute);

// start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
