const { pool } = require('./connection');
const bcrypt = require('bcrypt');

const seedDB = async () => {
    try {
        const connection = await pool.getConnection();

        console.log("Seeding database with demo data...");

        // 1. Seed Users (Admin, Driver, Customer demo accounts)
        const adminHash = await bcrypt.hash('admin123', 10);
        const demoHash = await bcrypt.hash('password', 10);

        const [adminResult] = await connection.query(`
            INSERT IGNORE INTO users (name, email, password, role) 
            VALUES ('Admin User', 'admin@flowops.com', ?, 'admin')
        `, [adminHash]);
        
        let adminId = adminResult.insertId;
        if (adminId === 0) {
             const [rows] = await connection.query("SELECT id FROM users WHERE email = 'admin@flowops.com'");
             adminId = rows[0].id;
        }

        // Seed demo Driver account
        await connection.query(`
            INSERT IGNORE INTO users (name, email, password, role) 
            VALUES ('Demo Driver', 'driver@flowops.com', ?, 'driver')
        `, [demoHash]);

        // Seed demo Customer account
        await connection.query(`
            INSERT IGNORE INTO users (name, email, password, role) 
            VALUES ('Demo Customer', 'customer@flowops.com', ?, 'customer')
        `, [demoHash]);


        // 2. Seed Customers
        await connection.query(`
            INSERT IGNORE INTO customers (name, email, phone, address) VALUES 
            ('Acme Corp', 'contact@acme.com', '555-0101', '123 Business Rd'),
            ('Globex', 'info@globex.com', '555-0102', '456 Tech Ave'),
            ('Soylent Corp', 'hello@soylent.com', '555-0103', '789 Industry Blvd'),
            ('Initech', 'support@initech.com', '555-0104', '321 Corporate Dr'),
            ('Umbrella Corp', 'admin@umbrella.com', '555-0105', '654 Research Pkwy')
        `);

        // 3. Seed Products
        await connection.query(`
            INSERT IGNORE INTO products (name, price, description) VALUES 
            ('SaaS Starter Plan', 49.99, 'Basic monthly subscription'),
            ('SaaS Pro Plan', 99.99, 'Advanced monthly subscription'),
            ('Enterprise License', 999.00, 'Yearly enterprise access'),
            ('Setup Fee', 199.00, 'One-time onboarding fee'),
            ('API Access Add-on', 29.99, 'Additional API rate limits')
        `);

        // 4. Get IDs for seeding Orders
        const [customers] = await connection.query("SELECT id FROM customers");
        const [products] = await connection.query("SELECT id, price FROM products");

        // 5. Seed Orders (only if empty)
        const [ordersCheck] = await connection.query("SELECT COUNT(*) as count FROM orders");
        
        if (ordersCheck[0].count === 0 && customers.length > 0 && products.length > 0) {
            for (let i = 0; i < 15; i++) {
                const randomCustomer = customers[Math.floor(Math.random() * customers.length)].id;
                const randomProduct = products[Math.floor(Math.random() * products.length)];
                const quantity = Math.floor(Math.random() * 3) + 1;
                const totalAmount = randomProduct.price * quantity;
                const statuses = ['pending', 'paid', 'shipped', 'completed'];
                const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
                
                // Random date in the last 6 months
                const randomDate = new Date(Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000);

                const [orderRes] = await connection.query(`
                    INSERT INTO orders (customer_id, total_amount, status, created_by, created_at) 
                    VALUES (?, ?, ?, ?, ?)
                `, [randomCustomer, totalAmount, randomStatus, adminId, randomDate]);

                await connection.query(`
                    INSERT INTO order_items (order_id, product_id, quantity) 
                    VALUES (?, ?, ?)
                `, [orderRes.insertId, randomProduct.id, quantity]);
            }
            console.log("Orders generated.");
        }

        console.log("Database seeded successfully! You can login with admin@flowops.com / admin123");
        connection.release();
        process.exit(0);

    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedDB();
