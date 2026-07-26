const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const getDashboardData = async (businessId) => {

    // -----------------------------------------------------------------
    // CONCURRENT DATABASE QUERIES FOR MASSIVE PERFORMANCE BOOST
    // -----------------------------------------------------------------
    const [
        [totalRows],
        [todayRows],
        [yesterdayRows],
        [weekRows],
        [prevWeekRows],
        [monthRows],
        [prevMonthRows],
        [statusDataRows],
        [outstandingRows],
        [todaySalesRawRows],
        [weeklySalesRawRows],
        [monthlySalesRawRows]
    ] = await Promise.all([
        pool.query("SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status = 'paid'", [businessId]),
        pool.query("SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()", [businessId]),
        pool.query("SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)", [businessId]),
        pool.query("SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND YEARWEEK(o.delivered_at, 1) = YEARWEEK(CURDATE(), 1)", [businessId]),
        pool.query("SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND YEARWEEK(o.delivered_at, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)", [businessId]),
        pool.query("SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND MONTH(o.delivered_at) = MONTH(CURDATE()) AND YEAR(o.delivered_at) = YEAR(CURDATE())", [businessId]),
        pool.query("SELECT SUM(o.total_amount) as sum FROM orders o WHERE o.business_id = ? AND o.payment_status = 'paid' AND MONTH(o.delivered_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(o.delivered_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))", [businessId]),
        pool.query("SELECT status, COUNT(*) as count FROM orders WHERE business_id = ? GROUP BY status", [businessId]),
        pool.query("SELECT SUM(amount) as sum FROM invoices WHERE business_id = ? AND status IN ('unpaid', 'overdue')", [businessId]),
        pool.query(`
            SELECT DATE_FORMAT(o.delivered_at, '%H') as hr, SUM(o.total_amount) as sales
            FROM orders o
            WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()
            GROUP BY DATE_FORMAT(o.delivered_at, '%H')
        `, [businessId]),
        pool.query(`
            SELECT DATE(o.delivered_at) as day, SUM(o.total_amount) as sales
            FROM orders o
            WHERE o.business_id = ? AND o.payment_status = 'paid'
              AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(o.delivered_at)
        `, [businessId]),
        pool.query(`
            SELECT DATE(o.delivered_at) as day, SUM(o.total_amount) as sales
            FROM orders o
            WHERE o.business_id = ? AND o.payment_status = 'paid'
              AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
            GROUP BY DATE(o.delivered_at)
        `, [businessId])
    ]);

    // -----------------------------------------------------------------
    // PROCESS RESULTS
    // -----------------------------------------------------------------
    const totalRevenue = totalRows[0].sum || 0;
    
    const todayRevenue = todayRows[0].sum || 0;
    const yesterdayRevenue = yesterdayRows[0].sum || 0;
    const todayGrowth = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    const weeklyRevenue = weekRows[0].sum || 0;
    const prevWeeklyRevenue = prevWeekRows[0].sum || 0;
    const weeklyGrowth = prevWeeklyRevenue > 0 ? ((weeklyRevenue - prevWeeklyRevenue) / prevWeeklyRevenue) * 100 : 0;

    const monthlyRevenue = monthRows[0].sum || 0;
    const prevMonthlyRevenue = prevMonthRows[0].sum || 0;
    const monthlyGrowth = prevMonthlyRevenue > 0 ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100 : 0;

    const outstandingAmount = outstandingRows[0].sum || 0;
    const statusData = statusDataRows;

    // Helper: format a Date object to 'DD Mon' e.g. '23 Jun'
    const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;
    const toYMD = (d) => d.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // --- DAILY MAP ---
    const todayMap = {};
    todaySalesRawRows.forEach(r => { todayMap[r.hr] = parseFloat(r.sales); });
    const todaySalesData = Array.from({ length: 24 }, (_, h) => ({
        label: fmtHour(h),
        sales: todayMap[String(h).padStart(2, '0')] || 0
    }));

    // --- WEEKLY MAP ---
    const weeklyMap = {};
    weeklySalesRawRows.forEach(r => { weeklyMap[toYMD(new Date(r.day))] = parseFloat(r.sales); });
    const weeklySalesData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { label: fmtDay(d), sales: weeklyMap[toYMD(d)] || 0 };
    });

    // --- MONTHLY MAP ---
    const monthlyMap = {};
    monthlySalesRawRows.forEach(r => { monthlyMap[toYMD(new Date(r.day))] = parseFloat(r.sales); });
    const monthlySalesData = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (29 - i));
        return { label: fmtDay(d), sales: monthlyMap[toYMD(d)] || 0 };
    });

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
