const { pool } = require('./connection');

async function migrate() {
    try {
        console.log("Starting Role Migration...");
        
        // 1. Pre-map 'user' to 'customer' to avoid truncation
        // First we need to allow 'customer' in the enum
        await pool.query("ALTER TABLE users MODIFY role ENUM('admin', 'user', 'customer') DEFAULT 'user'");
        await pool.query("UPDATE users SET role = 'customer' WHERE role = 'user'");
        
        // 2. Now set the final enum values
        await pool.query("ALTER TABLE users MODIFY role ENUM('superadmin', 'admin', 'driver', 'customer') DEFAULT 'customer'");
        
        // 3. Set Karan to superadmin
        await pool.query("UPDATE users SET role = 'superadmin' WHERE name = 'Karan'");
        
        // 2. Add driver_id to orders
        // Check if column exists first
        const [cols] = await pool.query("SHOW COLUMNS FROM orders LIKE 'driver_id'");
        if (cols.length === 0) {
            await pool.query("ALTER TABLE orders ADD COLUMN driver_id INT NULL");
            await pool.query("ALTER TABLE orders ADD CONSTRAINT fk_order_driver FOREIGN KEY (driver_id) REFERENCES users(id)");
            console.log("Added driver_id column and foreign key.");
        }

        console.log("Migration complete.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e.message);
        process.exit(1);
    }
}

migrate();
