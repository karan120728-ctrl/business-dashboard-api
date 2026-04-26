const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

// This is called by other services
const createNotification = async (io, userId, title, message) => {
    try {
        const [result] = await pool.query(
            "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
            [userId, title, message]
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
        // We usually don't throw here to avoid blocking the main transaction
    }
};

const getUserNotifications = async (userId) => {
    const [notifications] = await pool.query(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        [userId]
    );
    return notifications;
};

const markAllAsRead = async (userId) => {
    await pool.query(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
        [userId]
    );
    return true;
};

module.exports = {
    createNotification,
    getUserNotifications,
    markAllAsRead
};
