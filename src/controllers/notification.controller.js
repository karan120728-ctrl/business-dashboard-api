const notificationService = require("../services/notification.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");

const getNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.getUserNotifications(req.user.id);
        // Note: returning array directly to match old behavior
        return res.json(notifications);
    } catch (error) {
        return sendError(res, error);
    }
};

const markAsRead = async (req, res) => {
    try {
        await notificationService.markAllAsRead(req.user.id);
        return sendSuccess(res, 200, null, "Notifications marked as read");
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = { getNotifications, markAsRead };
