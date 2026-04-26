const { pool } = require('./connection');

const migrate = async () => {
    try {
        const connection = await pool.getConnection();
        console.log("Starting Logistics Migration...");

        // 1. Expand ENUM to allow all values temporarily
        console.log("Expanding ENUM...");
        await connection.query(`ALTER TABLE orders MODIFY status ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled', 'confirmed', 'out_for_delivery', 'delivered') DEFAULT 'pending'`);

        // 2. Update existing data to map to new enum values
        console.log("Mapping existing statuses...");
        await connection.query("UPDATE orders SET status = 'confirmed' WHERE status = 'paid'");
        await connection.query("UPDATE orders SET status = 'out_for_delivery' WHERE status = 'shipped'");
        await connection.query("UPDATE orders SET status = 'delivered' WHERE status = 'completed'");

        // 3. Restrict ENUM to only the new values
        console.log("Restricting ENUM...");
        await connection.query(`ALTER TABLE orders MODIFY status ENUM('pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending'`);

        // 3. Add new Logistics Columns
        console.log("Adding Logistics Columns...");
        
        const addColumn = async (colDef) => {
            try {
                await connection.query(`ALTER TABLE orders ADD COLUMN ${colDef}`);
                console.log(`Added column: ${colDef.split(' ')[0]}`);
            } catch(e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column ${colDef.split(' ')[0]} already exists.`);
                } else {
                    throw e;
                }
            }
        };

        await addColumn("driver_name VARCHAR(255)");
        await addColumn("vehicle_number VARCHAR(100)");
        await addColumn("delivery_location VARCHAR(255)");
        await addColumn("proof_image_url TEXT");
        await addColumn("packed_at TIMESTAMP NULL");
        await addColumn("out_for_delivery_at TIMESTAMP NULL");
        await addColumn("delivered_at TIMESTAMP NULL");

        console.log("Migration completed successfully!");
        connection.release();
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
};

migrate();
