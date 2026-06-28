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

// 1. Webhook Middlewares (MUST be before global express.json)
app.use("/api/payments/webhook/stripe", express.raw({ type: "application/json" }));
app.use("/api/payments/webhook/razorpay", express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

const PORT = process.env.PORT || 3000;

// 2. Global middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  const allowedOrigins = ['https://business-dashboard-api.vercel.app', 'http://localhost:55188', 'http://localhost:60755', 'http://localhost:3000', 'http://127.0.0.1:5500'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
  } else {
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
    
    // 🔥 CRITICAL FIX: Force add the missing columns to existing invoices table
    try { await pool.query("ALTER TABLE invoices ADD COLUMN razorpay_order_id VARCHAR(255) NULL"); } catch(e){}
    try { await pool.query("ALTER TABLE invoices ADD COLUMN razorpay_payment_id VARCHAR(255) NULL"); } catch(e){}
    try { await pool.query("ALTER TABLE invoices ADD COLUMN paid_at DATETIME NULL"); } catch(e){}
    try { await pool.query("ALTER TABLE users ADD COLUMN push_token VARCHAR(255) NULL"); } catch(e){}
    
    // 🔥 INVENTORY & ROUTING PHASE 2 MIGRATIONS
    try { await pool.query("ALTER TABLE products ADD COLUMN stock_quantity INT NOT NULL DEFAULT 0"); } catch(e){}
    try { await pool.query("ALTER TABLE products ADD COLUMN unit_size VARCHAR(50) NULL"); } catch(e){}
    try { await pool.query("ALTER TABLE orders ADD COLUMN batch_id INT NULL"); } catch(e){}
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS delivery_batches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                business_id INT NOT NULL,
                driver_id INT NOT NULL,
                status ENUM('pending', 'active', 'completed') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    } catch(e) {}
    try { await pool.query("ALTER TABLE orders ADD CONSTRAINT fk_order_batch FOREIGN KEY (batch_id) REFERENCES delivery_batches(id) ON DELETE SET NULL"); } catch(e){}
    
    // 🔥 CRITICAL FIX: Ensure audit table exists directly on startup
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(255),
        payload LONGTEXT,
        order_id VARCHAR(50),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ DATABASE MIGRATION: Payment columns and audit table ensured.");
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

  socket.on("joinBusiness", (businessId) => {
    socket.join(`business_${businessId}`);
    console.log(`Socket joined business room: business_${businessId}`);
  });

  socket.on("joinOrder", (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`Client joined tracking room for Order #${orderId}`);
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
    // Add Web Push Subscription column for real OS notifications
    try { await pool.query("ALTER TABLE users ADD COLUMN push_subscription TEXT NULL"); } catch(e){ console.log("push_subscription already exists or failed:", e.message); }

    await pool.query("ALTER TABLE orders MODIFY status ENUM('pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending'");
    
    // 4. Add Logistics columns to orders
    const logisticsCols = [
      "payment_status ENUM('unpaid', 'paid', 'overdue') DEFAULT 'unpaid'",
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
      // Find the first admin to make them the owner
      const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const ownerId = admins.length > 0 ? admins[0].id : null;
      
      const [res] = await pool.query(
        "INSERT INTO businesses (name, business_code, owner_id) VALUES ('FlowOps Global', 'FLOW-000000', ?)", 
        [ownerId]
      );
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
    
    // FORCE-RESET demo passwords (fixes 401 if accounts existed with wrong hash)
    await pool.query(`UPDATE users SET password = ?, business_id = ? WHERE email = 'admin@flowops.com'`, [adminHash, defaultBusId]);
    await pool.query(`UPDATE users SET password = ?, business_id = ? WHERE email = 'driver@flowops.com'`, [demoHash, defaultBusId]);
    await pool.query(`UPDATE users SET password = ?, business_id = ? WHERE email = 'customer@flowops.com'`, [demoHash, defaultBusId]);
    await pool.query(`INSERT IGNORE INTO customers (business_id, name, email, phone) VALUES (?, 'Acme Corp','contact@acme.com','555-0101'),(?, 'Globex','info@globex.com','555-0102'),(?, 'Soylent Corp','hello@soylent.com','555-0103')`, [defaultBusId, defaultBusId, defaultBusId]);
    await pool.query(`INSERT IGNORE INTO products (business_id, name, price, description) VALUES (?, 'SaaS Starter Plan',49.99,'Basic monthly subscription'),(?, 'SaaS Pro Plan',99.99,'Advanced monthly subscription'),(?, 'Enterprise License',999.00,'Yearly enterprise access')`, [defaultBusId, defaultBusId, defaultBusId]);
    
    // 9. Create Invoices Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_id INT NOT NULL,
        order_id INT NOT NULL,
        customer_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status ENUM('unpaid', 'paid', 'overdue') DEFAULT 'unpaid',
        due_date DATETIME NOT NULL,
        payment_token VARCHAR(255) NOT NULL UNIQUE,
        token_expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        paid_at DATETIME NULL,
        razorpay_order_id VARCHAR(255) NULL,
        razorpay_payment_id VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    // 10. Create Payment Audit Logs (For debugging)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(255),
        payload LONGTEXT,
        order_id VARCHAR(50),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    res.json({ message: "✅ NUCLEAR FIX APPLIED: All tables isolated, seeded, and invoices created!" });
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

const invoiceRoute = require("./routes/invoice.route");
app.use("/api/invoices", invoiceRoute);

const batchRoute = require("./routes/batch.route");
app.use("/api/batches", batchRoute);

const dashboardRoute = require("./routes/dashboard.route");
app.use("/api", dashboardRoute);

const paymentRoute = require("./routes/payment.routes.js");
app.use("/api/payments", paymentRoute);

// Route to log mobile app errors
app.post("/api/logs/error", async (req, res) => {
  const { error, stack, deviceInfo, screen, userId, userRole, apiDetails } = req.body;
  console.error("📱 [MOBILE ERROR] Screen:", screen, "User:", userId, "Role:", userRole, "\nMessage:", error, "\nAPI Details:", apiDetails);
  
  try {
    await pool.query(
      `INSERT INTO mobile_error_logs (error_message, error_stack, device_info, screen_context, user_id, user_role, api_details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        error || 'Unknown Error',
        stack || null,
        deviceInfo ? (typeof deviceInfo === 'object' ? JSON.stringify(deviceInfo) : String(deviceInfo)) : null,
        screen || null,
        userId || null,
        userRole || null,
        apiDetails ? (typeof apiDetails === 'object' ? JSON.stringify(apiDetails) : String(apiDetails)) : null
      ]
    );
    res.json({ success: true, message: "Error log recorded" });
  } catch (dbErr) {
    console.error("Failed to write mobile log to DB:", dbErr.message);
    res.status(500).json({ error: dbErr.message });
  }
});

// start background jobs
const { startCronJobs } = require("./utils/cronJobs");
startCronJobs();

// Global Error Handler (JSON)
app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  const status = err.statusCode || 500;
  res.status(status).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

// start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
