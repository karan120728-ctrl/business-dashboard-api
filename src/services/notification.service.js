const https = require("https");
const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const sendPushNotification = (expoPushToken, title, body) => {
    if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken")) return;
    
    const data = JSON.stringify({
        to: expoPushToken,
        title: title,
        body: body,
        sound: "default"
    });
    
    const options = {
        hostname: "exp.host",
        port: 443,
        path: "/--/api/v2/push/send",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": data.length,
        }
    };
    
    const req = https.request(options, (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
            responseBody += chunk;
        });
        res.on("end", () => {
            console.log("[Push Notification] Sent successfully:", responseBody);
        });
    });
    
    req.on("error", (err) => {
        console.error("[Push Notification] Error sending:", err.message);
    });
    
    req.write(data);
    req.end();
};

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

        // Trigger Push Notification if user has push_token registered
        try {
            const [uRows] = await pool.query("SELECT push_token FROM users WHERE id = ?", [userId]);
            if (uRows.length > 0 && uRows[0].push_token) {
                sendPushNotification(uRows[0].push_token, title, message);
            }
        } catch (pushErr) {
            console.error("[Push Notification] Query error:", pushErr.message);
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
