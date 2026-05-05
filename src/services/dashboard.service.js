const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const getDashboardData = async (businessId) => {
    // Basic aggregation for Total Revenue
    const [totalRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid'", [businessId]);
    const totalRevenue = totalRes[0].sum || 0;

    // Today Revenue
    const [todayRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND DATE(created_at) = CURDATE()", [businessId]);
    const todayRevenue = todayRes[0].sum || 0;

    // Weekly Revenue
    const [weekRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)", [businessId]);
    const weeklyRevenue = weekRes[0].sum || 0;

    // Monthly Revenue
    const [monthRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())", [businessId]);
    const monthlyRevenue = monthRes[0].sum || 0;

    // Status distribution
    const [statusData] = await pool.query("SELECT status, COUNT(*) as count FROM orders WHERE business_id = ? GROUP BY status", [businessId]);

    // Outstanding Amount (Unpaid + Overdue invoices)
    const [outstandingRes] = await pool.query("SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status IN ('unpaid', 'overdue')", [businessId]);
    const outstandingAmount = outstandingRes[0].sum || 0;

    // Monthly sales chart data (last 30 days grouped by date)
    const [monthlySalesData] = await pool.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as label, SUM(total_amount) as sales 
        FROM orders 
        WHERE business_id = ? AND payment_status = 'paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY label ASC
    `, [businessId]);

    // Today's hourly data for charts
    const [todaySalesData] = await pool.query(`
        SELECT DATE_FORMAT(created_at, '%H:00') as label, SUM(total_amount) as sales
        FROM orders
        WHERE business_id = ? AND payment_status = 'paid' AND DATE(created_at) = CURDATE()
        GROUP BY DATE_FORMAT(created_at, '%H:00')
        ORDER BY label ASC
    `, [businessId]);

    return {
        totalRevenue,
        todayRevenue,
        weeklyRevenue,
        monthlyRevenue,
        outstandingAmount,
        todayGrowth: 0.0,
        weeklyGrowth: 0.0,
        monthlyGrowth: 0.0,
        charts: {
            sales: {
                today: todaySalesData,
                weekly: [], // simplified
                monthly: monthlySalesData
            },
            statusWise: statusData
        }
    };
};

module.exports = {
    getDashboardData
};
