require("dotenv").config();
const mysql = require("mysql2/promise");

async function test() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Connecting...");
        const [rows] = await pool.query("SELECT * FROM payment_audit_logs");
        console.log("Rows:", rows.length);
        
        console.log("Trying insert...");
        await pool.query(
            "INSERT INTO payment_audit_logs (event_type, payload, status) VALUES (?, ?, ?)",
            ["test_event", JSON.stringify({a:1}), "test_status"]
        );
        console.log("Insert success!");
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        pool.end();
    }
}
test();
