const { pool } = require("../db/connection");
const { sendTransactionalEmail } = require("./emailService");

/**
 * Scalable background notification engine
 * 
 * @param {string} type - e.g., 'ORDER_CREATED', 'ORDER_DELIVERED', 'LOW_STOCK'
 * @param {object} payload - data necessary for the email body (e.g., orderId, amount, customerName)
 * @param {number} businessId - to lookup admins to notify
 */
const dispatchNotification = async (type, payload, businessId) => {
    try {
        // 1. Fetch all admins for this business
        const [admins] = await pool.query(
            "SELECT email, name FROM users WHERE business_id = ? AND (role = 'admin' OR role = 'superadmin') AND is_active = 1",
            [businessId]
        );

        if (admins.length === 0) return;

        // 2. Generate email subject and content based on event type
        let subject = '';
        let htmlContent = '';

        const wrapper = (title, body) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3 style="color: #4f46e5; border-bottom: 2px solid #eef2ff; padding-bottom: 10px;">${title}</h3>
                <div style="color: #334155; font-size: 15px; line-height: 1.6;">${body}</div>
                <p style="margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center;">Powered by FlowOps</p>
            </div>
        `;

        switch (type) {
            case 'ORDER_CREATED':
                subject = `New Order Placed: #${payload.orderId}`;
                htmlContent = wrapper(subject, `
                    <p>A new order has been received from <strong>${payload.customerName}</strong>.</p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p><strong>Order ID:</strong> #${payload.orderId}</p>
                        <p><strong>Total Amount:</strong> $${payload.amount}</p>
                        <p><strong>Status:</strong> Pending</p>
                    </div>
                    <p>Log in to your dashboard to review and assign this order to a batch route.</p>
                `);
                break;
            case 'ORDER_DELIVERED':
                subject = `Order Delivered! #${payload.orderId}`;
                htmlContent = wrapper(subject, `
                    <p>Driver <strong>${payload.driverName || 'a driver'}</strong> has completed delivery for Order <strong>#${payload.orderId}</strong>.</p>
                    <p>Customer: ${payload.customerName}</p>
                    <p>The proof of delivery camera snapshot has been uploaded to your dashboard successfully.</p>
                `);
                break;
            case 'LOW_STOCK':
                subject = `Low Stock Alert: ${payload.productName}`;
                htmlContent = wrapper(subject, `
                    <div style="background: #fff1f2; color: #be123c; border-left: 4px solid #e11d48; padding: 15px;">
                        <p style="margin-top:0;"><strong>Warning:</strong> The product <strong>${payload.productName}</strong> is running critically low.</p>
                        <p style="margin-bottom:0;">Current Stock Quantity: <strong>${payload.currentStock}</strong></p>
                    </div>
                    <p>Please restock immediately to prevent blocked orders.</p>
                `);
                break;
            default:
                console.log("Unknown notification type:", type);
                return;
        }

        // 3. Dispatch emails asynchronously (Fire-and-forget)
        admins.forEach(admin => {
            sendTransactionalEmail(admin.email, subject, htmlContent).catch(err => {
                console.error(`Failed sending background email to ${admin.email}:`, err.message);
            });
        });

    } catch (dbError) {
        console.error("Notification Engine Database Error:", dbError.message);
    }
};

module.exports = { dispatchNotification };
