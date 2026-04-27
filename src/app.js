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

// Health check
app.get("/", (req, res) => {
  res.send("FlowOps API is running ✅");
});

// One-click production seed endpoint
app.post("/api/seed", async (req, res) => {
  const { secret } = req.body;
  if (secret !== (process.env.SEED_SECRET || "flowops_seed_2026")) {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    const { pool } = require("./db/connection");
    const bcrypt = require("bcrypt");
    const adminHash = await bcrypt.hash("admin123", 10);
    const demoHash = await bcrypt.hash("password", 10);
    await pool.query(`INSERT IGNORE INTO users (name, email, password, role) VALUES ('Admin User','admin@flowops.com',?,'admin')`, [adminHash]);
    await pool.query(`INSERT IGNORE INTO users (name, email, password, role) VALUES ('Demo Driver','driver@flowops.com',?,'driver')`, [demoHash]);
    await pool.query(`INSERT IGNORE INTO users (name, email, password, role) VALUES ('Demo Customer','customer@flowops.com',?,'customer')`, [demoHash]);
    await pool.query(`INSERT IGNORE INTO customers (name, email, phone) VALUES ('Acme Corp','contact@acme.com','555-0101'),('Globex','info@globex.com','555-0102'),('Soylent Corp','hello@soylent.com','555-0103')`);
    await pool.query(`INSERT IGNORE INTO products (name, price, description) VALUES ('SaaS Starter Plan',49.99,'Basic monthly subscription'),('SaaS Pro Plan',99.99,'Advanced monthly subscription'),('Enterprise License',999.00,'Yearly enterprise access')`);
    res.json({ message: "✅ Seeded! Logins — admin@flowops.com/admin123 | driver@flowops.com/password | customer@flowops.com/password" });
  } catch (e) {
    res.status(500).json({ message: "Seed failed: " + e.message });
  }
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
