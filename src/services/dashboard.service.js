const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const getDashboardData = async (businessId) => {
    // Basic aggregation for Total Revenue
    const [totalRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid'", [businessId]);
    const totalRevenue = totalRes[0].sum || 0;

    // --- TODAY REVENUE & GROWTH ---
    const [todayRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND DATE(created_at) = CURDATE()", [businessId]);
    const todayRevenue = todayRes[0].sum || 0;

    const [yesterdayRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)", [businessId]);
    const yesterdayRevenue = yesterdayRes[0].sum || 0;
    const todayGrowth = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    // --- WEEKLY REVENUE & GROWTH ---
    const [weekRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)", [businessId]);
    const weeklyRevenue = weekRes[0].sum || 0;

    const [prevWeekRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND YEARWEEK(created_at, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)", [businessId]);
    const prevWeeklyRevenue = prevWeekRes[0].sum || 0;
    const weeklyGrowth = prevWeeklyRevenue > 0 ? ((weeklyRevenue - prevWeeklyRevenue) / prevWeeklyRevenue) * 100 : 0;

    // --- MONTHLY REVENUE & GROWTH ---
    const [monthRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())", [businessId]);
    const monthlyRevenue = monthRes[0].sum || 0;

    const [prevMonthRes] = await pool.query("SELECT SUM(total_amount) as sum FROM orders WHERE business_id = ? AND payment_status = 'paid' AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(created_at) = YEAR(CURDATE())", [businessId]);
    const prevMonthlyRevenue = prevMonthRes[0].sum || 0;
    const monthlyGrowth = prevMonthlyRevenue > 0 ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100 : 0;

    // Status distribution
    const [statusData] = await pool.query("SELECT status, COUNT(*) as count FROM orders WHERE business_id = ? GROUP BY status", [businessId]);

    // Outstanding Amount
    const [outstandingRes] = await pool.query("SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status IN ('unpaid', 'overdue')", [businessId]);
    const outstandingAmount = outstandingRes[0].sum || 0;

    // Monthly sales chart data
    const [monthlySalesData] = await pool.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as label, SUM(total_amount) as sales 
        FROM orders 
        WHERE business_id = ? AND payment_status = 'paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY label ASC
    `, [businessId]);

    // Today's hourly data
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
        todayGrowth: parseFloat(todayGrowth.toFixed(2)),
        weeklyGrowth: parseFloat(weeklyGrowth.toFixed(2)),
        monthlyGrowth: parseFloat(monthlyGrowth.toFixed(2)),
        charts: {
            sales: {
                today: todaySalesData,
                weekly: [],
                monthly: monthlySalesData
            },
            statusWise: statusData
        }
    };
};

module.exports = {
    getDashboardData
};
