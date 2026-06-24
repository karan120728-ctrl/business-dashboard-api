const notificationService = require("../services/notification.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const { pool } = require("../db/connection");

const getNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.getUserNotifications(req.user.id, req.user.business_id);
        return res.json(notifications);
    } catch (error) {
        return sendError(res, error);
    }
};

const markAsRead = async (req, res) => {
    try {
        await notificationService.markAllAsRead(req.user.id, req.user.business_id);
        return sendSuccess(res, 200, null, "Notifications marked as read");
    } catch (error) {
        return sendError(res, error);
    }
};

const clearAll = async (req, res) => {
    try {
        await pool.query("DELETE FROM notifications WHERE user_id = ? AND business_id = ?", [req.user.id, req.user.business_id]);
        return sendSuccess(res, 200, null, "Notifications cleared");
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = { getNotifications, markAsRead, clearAll };
