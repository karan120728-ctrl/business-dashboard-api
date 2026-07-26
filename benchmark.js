require('dotenv').config();
const { pool } = require('./src/db/connection');

async function benchmarkQueries() {
    const businessId = 1;

    const queries = [
        "SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status = 'paid'",
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()",
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)",
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND YEARWEEK(o.delivered_at, 1) = YEARWEEK(CURDATE(), 1)",
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND YEARWEEK(o.delivered_at, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)",
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND MONTH(o.delivered_at) = MONTH(CURDATE()) AND YEAR(o.delivered_at) = YEAR(CURDATE())",
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND MONTH(o.delivered_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(o.delivered_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))",
        "SELECT status, COUNT(*) as count FROM orders WHERE business_id = ? GROUP BY status",
        "SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status IN ('unpaid', 'overdue')",
        `
            SELECT DATE_FORMAT(o.delivered_at, '%H') as hr, SUM(o.total_amount) as sales
            FROM orders o
            WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()
            GROUP BY DATE_FORMAT(o.delivered_at, '%H')
        `,
        `
            SELECT DATE(o.delivered_at) as day, SUM(o.total_amount) as sales
            FROM orders o
            WHERE o.business_id = ? AND o.payment_status = 'paid'
              AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(o.delivered_at)
        `,
        `
            SELECT DATE(o.delivered_at) as day, SUM(o.total_amount) as sales
            FROM orders o
            WHERE o.business_id = ? AND o.payment_status = 'paid'
              AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
            GROUP BY DATE(o.delivered_at)
        `
    ];

    for (let i = 0; i < queries.length; i++) {
        const start = Date.now();
        await pool.query(queries[i], [businessId]);
        const end = Date.now();
        console.log(`Query ${i + 1} took ${end - start} ms`);
    }
    process.exit(0);
}
benchmarkQueries();
