const dashboardService = require("../services/dashboard.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");

const getDashboardData = async (req, res) => {
    try {
        if (!req.user || !req.user.business_id) {
            return sendError(res, new Error("Unauthorized: Business ID missing"), 401);
        }
        
        const data = await dashboardService.getDashboardData(req.user.business_id);
        
        if (!data) {
            return res.status(404).json({ message: "Dashboard data not found" });
        }
        
        // Return raw data object to maintain backward compatibility
        return res.json(data);
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = { getDashboardData };
