const dashboardService = require("../services/dashboard.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");

const getDashboardData = async (req, res) => {
    try {
        const data = await dashboardService.getDashboardData();
        // Return raw data object to maintain backward compatibility
        return res.json(data);
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = { getDashboardData };
