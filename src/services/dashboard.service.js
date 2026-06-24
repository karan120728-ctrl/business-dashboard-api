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
    // CHARTS — with full date ranges (fill gaps with 0)
    // -----------------------------------------------------------------

    // Helper: format a Date object to 'DD Mon' e.g. '23 Jun'
    const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;
    const toYMD = (d) => d.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // --- DAILY CHART: each hour 00-23 of today ---
    const [todaySalesRaw] = await pool.query(`
        SELECT DATE_FORMAT(o.delivered_at, '%H') as hr, SUM(o.total_amount) as sales
        FROM orders o
        WHERE o.business_id = ? AND o.payment_status = 'paid' AND DATE(o.delivered_at) = CURDATE()
        GROUP BY DATE_FORMAT(o.delivered_at, '%H')
    `, [businessId]);
    const todayMap = {};
    todaySalesRaw.forEach(r => { todayMap[r.hr] = parseFloat(r.sales); });
    const todaySalesData = Array.from({ length: 24 }, (_, h) => ({
        label: fmtHour(h),
        sales: todayMap[String(h).padStart(2, '0')] || 0
    }));

    // --- WEEKLY CHART: last 7 days (rolling week) ---
    const [weeklySalesRaw] = await pool.query(`
        SELECT DATE(o.delivered_at) as day, SUM(o.total_amount) as sales
        FROM orders o
        WHERE o.business_id = ? AND o.payment_status = 'paid'
          AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(o.delivered_at)
    `, [businessId]);
    const weeklyMap = {};
    weeklySalesRaw.forEach(r => { weeklyMap[toYMD(new Date(r.day))] = parseFloat(r.sales); });
    const weeklySalesData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { label: fmtDay(d), sales: weeklyMap[toYMD(d)] || 0 };
    });

    // --- MONTHLY CHART: last 30 days ---
    const [monthlySalesRaw] = await pool.query(`
        SELECT DATE(o.delivered_at) as day, SUM(o.total_amount) as sales
        FROM orders o
        WHERE o.business_id = ? AND o.payment_status = 'paid'
          AND o.delivered_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(o.delivered_at)
    `, [businessId]);
    const monthlyMap = {};
    monthlySalesRaw.forEach(r => { monthlyMap[toYMD(new Date(r.day))] = parseFloat(r.sales); });
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
