const invoiceService = require("../services/invoice.service");

// Runs every hour
const ONE_HOUR = 60 * 60 * 1000;

const startCronJobs = () => {
    console.log("⏳ Starting background cron jobs...");

    setInterval(async () => {
        try {
            console.log("🔄 Running check for overdue invoices...");
            const overdueCount = await invoiceService.markOverdue();
            if (overdueCount > 0) {
                console.log(`⚠️ Marked ${overdueCount} invoices as overdue.`);
            }
        } catch (error) {
            console.error("❌ Error in overdue invoice cron job:", error);
        }
    }, ONE_HOUR);
};

module.exports = { startCronJobs };
