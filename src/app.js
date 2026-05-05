require("dotenv").config();
const express = require("express");
const path = require("path");
const { connectDB, pool } = require("./db/connection");
const initDB = require("./db/init");
const bcrypt = require("bcrypt");
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

// middleware - Increased limits for proof image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((req, res, next) => {
  const allowedOrigins = ['https://business-dashboard-api.vercel.app', 'http://localhost:55188', 'http://localhost:60755', 'http://localhost:3000', 'http://127.0.0.1:5500'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
  } else {
      // Fallback for Vercel if origin header is missing in some cases
      res.header("Access-Control-Allow-Origin", "https://business-dashboard-api.vercel.app");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Serve uploaded proof images as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// connect DB and initialize tables
connectDB().then(async () => {
  // Direct Migration Force
  try {
    await pool.query("ALTER TABLE orders MODIFY COLUMN proof_image_url LONGTEXT;");
    console.log("✅ DATABASE MIGRATION: proof_image_url forced to LONGTEXT");
  } catch(e) {
    console.log("Database migration note:", e.message);
  }
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
app.get("/api/seed", async (req, res) => {
  const secret = req.query.secret;
  if (secret !== (process.env.SEED_SECRET || "flowops_seed_2026")) {
    return res.status(403).json({ message: "Forbidden. Provide ?secret=..." });
  }
  try {
    // 1. NUCLEAR SCHEMA FIX: Ensure Businesses table exists first
    await pool.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        business_code VARCHAR(50) NOT NULL UNIQUE,
        owner_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Add business_id column to all isolated tables
    const tablesToIsolated = ['users', 'customers', 'products', 'orders', 'notifications'];
    for (const table of tablesToIsolated) {
      const [exists] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE 'business_id'`);
      if (exists.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN business_id INT NULL AFTER id`);
        // Add constraint if possible
        try {
          await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT fk_${table}_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE`);
        } catch(e) { console.log(`Constraint for ${table} already exists or failed:`, e.message); }
      }
    }

    // 3. Update existing table columns and roles
    await pool.query("ALTER TABLE users MODIFY role ENUM('superadmin', 'admin', 'driver', 'customer') DEFAULT 'customer'");
    
    // Add Security Columns to users (Direct Force)
    try { await pool.query("ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(255) NULL"); } catch(e){ console.log("reset_token_hash already exists or failed:", e.message); }
    try { await pool.query("ALTER TABLE users ADD COLUMN reset_expires TIMESTAMP NULL"); } catch(e){ console.log("reset_expires already exists or failed:", e.message); }

    await pool.query("ALTER TABLE orders MODIFY status ENUM('pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending'");
    
    // 4. Add Logistics columns to orders
    const logisticsCols = [
      "driver_id INT NULL",
      "driver_name VARCHAR(255)",
      "vehicle_number VARCHAR(100)",
      "delivery_location VARCHAR(255)",
      "current_address TEXT",
      "proof_image_url LONGTEXT",
      "packed_at TIMESTAMP NULL",
      "out_for_delivery_at TIMESTAMP NULL",
      "delivered_at TIMESTAMP NULL"
    ];

    for (const col of logisticsCols) {
      const colName = col.split(" ")[0];
      const [exists] = await pool.query(`SHOW COLUMNS FROM orders LIKE ?`, [colName]);
      if (exists.length === 0) {
        await pool.query(`ALTER TABLE orders ADD COLUMN ${col}`);
      }
    }

    // 5. Ensure Unique Constraint for Customers (Multi-Tenant)
    try {
      await pool.query("ALTER TABLE customers ADD UNIQUE INDEX idx_business_email (business_id, email)");
    } catch(e) {}

    // 6. Ensure a default business exists for migration
    const [busRows] = await pool.query("SELECT id FROM businesses LIMIT 1");
    let defaultBusId = 1;
    if (busRows.length === 0) {
      const [res] = await pool.query("INSERT INTO businesses (name, business_code) VALUES ('FlowOps Global', 'FLOW-000000')");
      defaultBusId = res.insertId;
    } else {
      defaultBusId = busRows[0].id;
    }

    // 7. Migrate existing records to the default business
    for (const table of tablesToIsolated) {
      await pool.query(`UPDATE ${table} SET business_id = ? WHERE business_id IS NULL`, [defaultBusId]);
    }

    const adminHash = await bcrypt.hash("admin123", 10);
    const demoHash = await bcrypt.hash("password", 10);
    
    // 8. Seed Default Data
    await pool.query(`INSERT IGNORE INTO users (business_id, name, email, password, role) VALUES (?, 'Admin User','admin@flowops.com',?,'admin')`, [defaultBusId, adminHash]);
    await pool.query(`INSERT IGNORE INTO users (business_id, name, email, password, role) VALUES (?, 'Demo Driver','driver@flowops.com',?,'driver')`, [defaultBusId, demoHash]);
    await pool.query(`INSERT IGNORE INTO users (business_id, name, email, password, role) VALUES (?, 'Demo Customer','customer@flowops.com',?,'customer')`, [defaultBusId, demoHash]);
    await pool.query(`INSERT IGNORE INTO customers (business_id, name, email, phone) VALUES (?, 'Acme Corp','contact@acme.com','555-0101'),(?, 'Globex','info@globex.com','555-0102'),(?, 'Soylent Corp','hello@soylent.com','555-0103')`, [defaultBusId, defaultBusId, defaultBusId]);
    await pool.query(`INSERT IGNORE INTO products (business_id, name, price, description) VALUES (?, 'SaaS Starter Plan',49.99,'Basic monthly subscription'),(?, 'SaaS Pro Plan',99.99,'Advanced monthly subscription'),(?, 'Enterprise License',999.00,'Yearly enterprise access')`, [defaultBusId, defaultBusId, defaultBusId]);
    
    res.json({ message: "✅ NUCLEAR FIX APPLIED: All tables isolated and seeded!" });
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
