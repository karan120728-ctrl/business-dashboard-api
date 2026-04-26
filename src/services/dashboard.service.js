const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const getDashboardData = async () => {
    // Basic aggregation for Total Revenue
    const [totalRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE status != 'cancelled'");
    const totalRevenue = totalRes[0].sum || 0;

    // Today Revenue
    const [todayRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE()");
    const todayRevenue = todayRes[0].sum || 0;

    // Weekly Revenue
    const [weekRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE status != 'cancelled' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)");
    const weeklyRevenue = weekRes[0].sum || 0;

    // Monthly Revenue
    const [monthRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE status != 'cancelled' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())");
    const monthlyRevenue = monthRes[0].sum || 0;

    // Status distribution
    const [statusData] = await pool.query("SELECT status, COUNT(*) as count FROM orders GROUP BY status");

    // Monthly sales chart data (last 30 days grouped by date)
    const [monthlySalesData] = await pool.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as label, SUM(total_amount) as sales 
        FROM orders 
        WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY label ASC
    `);

    // Today's hourly data for charts
    const [todaySalesData] = await pool.query(`
        SELECT DATE_FORMAT(created_at, '%H:00') as label, SUM(total_amount) as sales
        FROM orders
        WHERE status != 'cancelled' AND DATE(created_at) = CURDATE()
        GROUP BY DATE_FORMAT(created_at, '%H:00')
        ORDER BY label ASC
    `);

    // We can simulate growth for now or calculate from past data
    return {
        totalRevenue,
        todayRevenue,
        weeklyRevenue,
        monthlyRevenue,
        todayGrowth: 5.2, // mock growth
        weeklyGrowth: 1.1, // mock growth
        monthlyGrowth: -2.3, // mock growth
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
