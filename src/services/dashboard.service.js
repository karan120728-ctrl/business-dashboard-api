const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const getDashboardData = async (businessId) => {

    // -----------------------------------------------------------------
    // REVENUE METRICS — based on delivered_at (when $ was actually earned)
    // -----------------------------------------------------------------

    // All-time total collected (paid invoices)
    const [totalRes] = await pool.query(
        "SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status = 'paid'",
        [businessId]
    );
    const totalRevenue = totalRes[0].sum || 0;

    // --- TODAY ---
    const [todayRes] = await pool.query(
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()",
        [businessId]
    );
    const todayRevenue = todayRes[0].sum || 0;

    const [yesterdayRes] = await pool.query(
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)",
        [businessId]
    );
    const yesterdayRevenue = yesterdayRes[0].sum || 0;
    const todayGrowth = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    // --- WEEKLY ---
    const [weekRes] = await pool.query(
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND YEARWEEK(o.delivered_at, 1) = YEARWEEK(CURDATE(), 1)",
        [businessId]
    );
    const weeklyRevenue = weekRes[0].sum || 0;

    const [prevWeekRes] = await pool.query(
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND YEARWEEK(o.delivered_at, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)",
        [businessId]
    );
    const prevWeeklyRevenue = prevWeekRes[0].sum || 0;
    const weeklyGrowth = prevWeeklyRevenue > 0 ? ((weeklyRevenue - prevWeeklyRevenue) / prevWeeklyRevenue) * 100 : 0;

    // --- MONTHLY ---
    const [monthRes] = await pool.query(
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND MONTH(o.delivered_at) = MONTH(CURDATE()) AND YEAR(o.delivered_at) = YEAR(CURDATE())",
        [businessId]
    );
    const monthlyRevenue = monthRes[0].sum || 0;

    const [prevMonthRes] = await pool.query(
        "SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND MONTH(o.delivered_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(o.delivered_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))",
        [businessId]
    );
    const prevMonthlyRevenue = prevMonthRes[0].sum || 0;
    const monthlyGrowth = prevMonthlyRevenue > 0 ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100 : 0;

    // -----------------------------------------------------------------
    // ORDER STATUS DISTRIBUTION (for donut chart)
    // -----------------------------------------------------------------
    const [statusData] = await pool.query(
        "SELECT status, COUNT(*) as count FROM orders WHERE business_id = ? GROUP BY status",
        [businessId]
    );

    // -----------------------------------------------------------------
    // OUTSTANDING AMOUNT — from invoices (unpaid + overdue)
    // -----------------------------------------------------------------
    const [outstandingRes] = await pool.query(
        "SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status IN ('unpaid', 'overdue')",
        [businessId]
    );
    const outstandingAmount = outstandingRes[0].sum || 0;

    // -----------------------------------------------------------------
    // CHARTS
    // -----------------------------------------------------------------

    // Daily chart: Revenue per hour today
    const [todaySalesData] = await pool.query(`
        SELECT DATE_FORMAT(o.delivered_at, '%H:00') as label, SUM(o.total_amount) as sales
        FROM orders o
        WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()
        GROUP BY DATE_FORMAT(o.delivered_at, '%H:00')
        ORDER BY DATE_FORMAT(o.delivered_at, '%H:00') ASC
    `, [businessId]);

    // Weekly chart: Revenue per day this week (Mon–Sun)
    const [weeklySalesData] = await pool.query(`
        SELECT DATE(o.delivered_at) as label, SUM(o.total_amount) as sales
        FROM orders o
        WHERE o.business_id = ?
          AND o.payment_status = 'paid'
          AND YEARWEEK(o.delivered_at, 1) = YEARWEEK(CURDATE(), 1)
        GROUP BY DATE(o.delivered_at)
        ORDER BY DATE(o.delivered_at) ASC
    `, [businessId]);

    // Monthly chart: Revenue per day over last 30 days
    const [monthlySalesData] = await pool.query(`
        SELECT DATE(o.delivered_at) as label, SUM(o.total_amount) as sales
        FROM orders o
        WHERE o.business_id = ?
          AND o.payment_status = 'paid'
          AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(o.delivered_at)
        ORDER BY DATE(o.delivered_at) ASC
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
                weekly: weeklySalesData,
                monthly: monthlySalesData
            },
            statusWise: statusData
        }
    };
};

module.exports = {
    getDashboardData
};
