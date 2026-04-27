const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

// This is called by other services
const createNotification = async (io, businessId, userId, title, message) => {
    try {
        const [result] = await pool.query(
            "INSERT INTO notifications (business_id, user_id, title, message) VALUES (?, ?, ?, ?)",
            [businessId, userId, title, message]
        );
        
        const newNotif = {
            id: result.insertId,
            title,
            message,
            is_read: 0,
            created_at: new Date()
        };

        if (io) {
            io.to(`user_${userId}`).emit("notification", newNotif);
        }
        return newNotif;
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

const getUserNotifications = async (userId, businessId) => {
    const [notifications] = await pool.query(
        "SELECT * FROM notifications WHERE user_id = ? AND business_id = ? ORDER BY created_at DESC LIMIT 50",
        [userId, businessId]
    );
    return notifications;
};

const markAllAsRead = async (userId, businessId) => {
    await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND business_id = ? AND is_read = FALSE",
        [userId, businessId]
    );
    return true;
};

module.exports = {
    createNotification,
    getUserNotifications,
    markAllAsRead
};
