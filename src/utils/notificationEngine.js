const { pool } = require("../db/connection");
const { sendTransactionalEmail } = require("./emailService");
const webpush = require("web-push");

// Configure VAPID — required for Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_MAILTO || 'mailto:admin@flowops.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

/**
 * Scalable background notification engine
 * Sends: 1) Web Push (real OS notification), 2) Email fallback
 * 
 * @param {string} type - e.g., 'ORDER_CREATED', 'ORDER_DELIVERED', 'LOW_STOCK'
 * @param {object} payload - data for the notification body
 * @param {number} businessId - to lookup admins to notify
 */
const dispatchNotification = async (type, payload, businessId) => {
    try {
        // 1. Fetch all active admins with push subscriptions
        const [admins] = await pool.query(
            `SELECT email, name, push_subscription 
             FROM users 
             WHERE business_id = ? AND (role = 'admin' OR role = 'superadmin') AND is_active = 1`,
            [businessId]
        );

        if (admins.length === 0) return;

        // 2. Build notification content based on type
        let title = '';
        let body = '';
        let subject = '';
        let htmlContent = '';

        const htmlWrapper = (t, b) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3 style="color: #4f46e5; border-bottom: 2px solid #eef2ff; padding-bottom: 10px;">${t}</h3>
                <div style="color: #334155; font-size: 15px; line-height: 1.6;">${b}</div>
                <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">Powered by FlowOps</p>
            </div>
        `;

        switch (type) {
            case 'ORDER_CREATED':
                title = '📦 New Order Received!';
                body = `${payload.customerName} just placed an order for $${payload.amount}`;
                subject = `New Order #${payload.orderId} — $${payload.amount}`;
                htmlContent = htmlWrapper(subject, `
                    <p>A new order has been received from <strong>${payload.customerName}</strong>.</p>
                    <div style="background:#f8fafc;padding:15px;border-radius:6px;margin:20px 0;">
                        <p><strong>Order ID:</strong> #${payload.orderId}</p>
                        <p><strong>Amount:</strong> $${payload.amount}</p>
                        <p><strong>Status:</strong> Pending</p>
                    </div>
                    <p>Log in to your <a href="https://flowops.netlify.app/dashboard.html" style="color:#4f46e5;">FlowOps Dashboard</a> to assign it to a driver route.</p>
                `);
                break;

            case 'ORDER_DELIVERED':
                title = '✅ Order Delivered!';
                body = `Order #${payload.orderId} was successfully delivered by ${payload.driverName || 'your driver'}.`;
                subject = `Delivery Complete: Order #${payload.orderId}`;
                htmlContent = htmlWrapper(subject, `
                    <p>Driver <strong>${payload.driverName || 'a driver'}</strong> has completed delivery for Order <strong>#${payload.orderId}</strong>.</p>
                    <p>An invoice has been automatically generated and sent to the customer.</p>
                `);
                break;

            case 'LOW_STOCK':
                title = '⚠️ Low Stock Alert!';
                body = `${payload.productName} is critically low — only ${payload.currentStock} units left!`;
                subject = `Low Stock Alert: ${payload.productName}`;
                htmlContent = htmlWrapper(subject, `
                    <div style="background:#fff1f2;color:#be123c;border-left:4px solid #e11d48;padding:15px;">
                        <p style="margin-top:0;"><strong>Warning:</strong> <strong>${payload.productName}</strong> is critically low.</p>
                        <p style="margin-bottom:0;">Current Stock: <strong>${payload.currentStock} units</strong></p>
                    </div>
                    <p>Please restock immediately to prevent blocked orders.</p>
                `);
                break;

            default:
                console.log("Unknown notification type:", type);
                return;
        }

        // 3. Send to every admin asynchronously (fire-and-forget)
        for (const admin of admins) {
            // A) Web Push Notification (works even when browser tab is closed!)
            if (admin.push_subscription && process.env.VAPID_PUBLIC_KEY) {
                try {
                    const subscription = JSON.parse(admin.push_subscription);
                    const pushPayload = JSON.stringify({ title, body, url: '/dashboard.html', tag: type });
                    webpush.sendNotification(subscription, pushPayload).catch(async (err) => {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            // Subscription expired — clear it
                            await pool.query("UPDATE users SET push_subscription = NULL WHERE email = ?", [admin.email]);
                            console.log(`🧹 Cleared expired push subscription for ${admin.email}`);
                        } else {
                            console.error(`❌ Web Push error for ${admin.email}:`, err.message);
                        }
                    });
                } catch (e) {
                    console.error("Invalid push_subscription JSON for:", admin.email);
                }
            }

            // B) Email fallback (always sends as backup)
            sendTransactionalEmail(admin.email, subject, htmlContent).catch(err => {
                console.error(`❌ Email notification failed for ${admin.email}:`, err.message);
            });
        }

    } catch (dbError) {
        console.error("Notification Engine Database Error:", dbError.message);
    }
};

module.exports = { dispatchNotification };
