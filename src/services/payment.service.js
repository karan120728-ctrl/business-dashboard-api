const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const Razorpay = require('razorpay');
const { pool } = require('../db/connection');
const AppError = require('../utils/AppError');

// Initialize Razorpay conditionally
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

const createCheckoutSession = async (orderId, businessId) => {
    // 1. Fetch order details correctly (join with customers table)
    const [orders] = await pool.query(
        "SELECT o.*, c.name as customer_name, c.email as customer_email FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ? AND o.business_id = ?",
        [orderId, businessId]
    );

    if (orders.length === 0) {
        throw new AppError("Order not found or unauthorized", 404);
    }

    const order = orders[0];
    const currency = order.currency || 'INR'; 
    
    console.log(`[Payment] Creating session for Order #${orderId}, Currency: ${currency}, Amount: ${order.total_amount}`);

    // 2. Determine Gateway
    if (currency === 'INR') {
        // --- RAZORPAY FLOW ---
        if (!razorpay) {
            console.error("[Payment] Razorpay keys missing in environment variables!");
            throw new AppError("Razorpay is not configured on this server.", 500);
        }

        try {
            let amountInPaise = Math.round(parseFloat(order.total_amount) * 100);
            if (amountInPaise < 100) amountInPaise = 100; // Razorpay minimum is 100 paise (1 INR)

            const paymentPayload = {
                amount: amountInPaise,
                currency: "INR",
                accept_partial: false,
                description: `Order #${order.id} - Logistics Services`,
                customer: {
                    name: order.customer_name || "Customer",
                    email: order.customer_email || "billing@flowops.com",
                    contact: "" 
                },
                notify: { sms: false, email: true },
                reminder_enable: true,
                notes: {
                    orderId: order.id.toString(),
                    businessId: businessId.toString()
                },
                callback_url: `${process.env.FRONTEND_URL || 'https://business-dashboard-api.vercel.app'}/index.html?status=success&orderId=${order.id}`,
                callback_method: "get"
            };

            console.log("[Payment] Sending payload to Razorpay:", JSON.stringify(paymentPayload));
            const paymentLink = await razorpay.paymentLink.create(paymentPayload);
            console.log("[Payment] Razorpay link generated:", paymentLink.short_url);
            return paymentLink.short_url;
        } catch (razorError) {
            console.error("[Payment] Razorpay API Error Details:", JSON.stringify(razorError));
            const errorMsg = razorError.description || razorError.message || JSON.stringify(razorError);
            throw new AppError(`Razorpay Error: ${errorMsg}`, 500);
        }
    } else {
        // --- STRIPE FLOW ---
        if (!stripe) {
            console.error("[Payment] Stripe key missing in environment variables!");
            throw new AppError("Stripe is not configured on this server.", 500);
        }

        try {
            const sessionPayload = {
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: currency.toLowerCase(),
                            product_data: {
                                name: `Order #${order.id} - Logistics Services`,
                            },
                            unit_amount: Math.round(parseFloat(order.total_amount) * 100),
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${process.env.FRONTEND_URL || 'https://business-dashboard-api.vercel.app'}/index.html?status=success&orderId=${order.id}`,
                cancel_url: `${process.env.FRONTEND_URL || 'https://business-dashboard-api.vercel.app'}/index.html?status=cancelled`,
                metadata: {
                    orderId: order.id.toString(),
                    businessId: businessId.toString()
                }
            };

            console.log("[Payment] Creating Stripe Session with payload:", JSON.stringify(sessionPayload));
            const session = await stripe.checkout.sessions.create(sessionPayload);
            console.log("[Payment] Stripe Session generated:", session.url);
            return session.url;
        } catch (stripeError) {
            console.error("[Payment] Stripe API Error:", stripeError);
            throw new AppError(`Stripe Error: ${stripeError.message}`, 500);
        }
    }
};

const createSessionFromToken = async (token) => {
    // 1. Find invoice by token
    const [invoices] = await pool.query(
        "SELECT i.*, b.id as business_id FROM invoices i JOIN businesses b ON i.business_id = b.id WHERE i.payment_token = ? AND i.status != 'paid'",
        [token]
    );

    if (invoices.length === 0) {
        throw new AppError("Invalid or already paid invoice token", 400);
    }

    const invoice = invoices[0];
    // Re-use the existing checkout logic
    return await createCheckoutSession(invoice.order_id, invoice.business_id);
};

const handleStripeWebhook = async (event) => {
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { orderId } = session.metadata;
        await markOrderAsPaid(orderId);
    }
};

const handleRazorpayWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'flowops_secret_2026';
    const RazorpaySDK = require('razorpay');

    console.log("[Audit] Webhook Received. Starting Validation...");
    
    const isValid = RazorpaySDK.validateWebhookSignature(
        req.rawBody.toString(), 
        signature, 
        secret
    );

    const payload = req.body;

    // Log the attempt to the database for debugging
    try {
        await pool.query(
            "INSERT INTO payment_audit_logs (event_type, payload, status) VALUES (?, ?, ?)",
            [payload.event, JSON.stringify(payload), isValid ? 'verified' : 'invalid_signature']
        );
    } catch (e) { console.error("Failed to log audit:", e.message); }

    if (!isValid) {
        console.error("[Audit] FAILED: Invalid Razorpay Signature.");
        return res.status(400).send('Invalid Signature');
    }

    console.log("[Audit] Signature Verified. Processing payload...");
    let orderId = null;
    let paymentId = null;

    // Step 1 & 3: HARDENED Payload Inspection
    try {
        if (payload.event === 'payment_link.paid') {
            const pl = payload.payload.payment_link.entity;
            const p = payload.payload.payment.entity;
            orderId = pl.notes.orderId || pl.notes.order_id || p.notes.orderId;
            paymentId = p.id;
        } else if (payload.event === 'payment.captured') {
            const p = payload.payload.payment.entity;
            orderId = p.notes.orderId || p.notes.order_id;
            paymentId = p.id;
        }

        console.log(`[Audit] Event: ${payload.event}, Extracted OrderID: ${orderId}, PaymentID: ${paymentId}`);
        
        if (orderId) {
            // Update the audit log with the order ID we found
            await pool.query("UPDATE payment_audit_logs SET order_id = ? WHERE id = (SELECT LAST_INSERT_ID())", [orderId]);
            await markOrderAsPaid(orderId, paymentId);
        } else {
            console.error("[Audit] FAILED: No Order ID found. Payload keys:", Object.keys(payload.payload));
        }
    } catch (e) {
        console.error("[Audit] CRITICAL Webhook Parse Error:", e.message);
    }

    return res.status(200).send('OK');
};

const markOrderAsPaid = async (orderId, paymentId = null) => {
    console.log(`[Audit] Starting Database Update for Order #${orderId}...`);
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // Step 4: Verify Invoice Lookup
        const [invoices] = await connection.query(
            "SELECT id, status FROM invoices WHERE order_id = ?", [orderId]
        );
        
        if (invoices.length === 0) {
            console.error(`[Audit] FAILED: No matching invoice found for Order #${orderId}`);
            await connection.rollback();
            return;
        }

        if (invoices[0].status === 'paid') {
            console.log(`[Audit] SKIP: Order #${orderId} is already marked as PAID.`);
            await connection.rollback();
            return;
        }

        // Step 5: Execute and Log Affected Rows
        const [orderResult] = await connection.query(
            "UPDATE orders SET payment_status = 'paid' WHERE id = ?", [orderId]
        );
        console.log(`[Audit] Orders Update: ${orderResult.affectedRows} row(s) affected.`);

        const [invoiceResult] = await connection.query(
            "UPDATE invoices SET status = 'paid', paid_at = NOW(), razorpay_payment_id = ?, used_at = NOW() WHERE order_id = ?",
            [paymentId, orderId]
        );
        console.log(`[Audit] Invoices Update: ${invoiceResult.affectedRows} row(s) affected.`);

        // Step 6: Commit Transaction
        await connection.commit();
        console.log(`[Audit] SUCCESS: Transaction committed for Order #${orderId}`);

        // Step 7: Post-Update Verification
        const [finalOrder] = await connection.query("SELECT payment_status FROM orders WHERE id = ?", [orderId]);
        console.log(`[Audit] Final Database State for Order #${orderId}: ${finalOrder[0].payment_status}`);

        // Notification (Decoupled)
        try {
            const [details] = await connection.query(
                "SELECT o.business_id, o.total_amount, b.owner_id, c.name as customer_name FROM orders o JOIN businesses b ON o.business_id = b.id JOIN customers c ON o.customer_id = c.id WHERE o.id = ?",
                [orderId]
            );

            if (details.length > 0) {
                const { business_id, owner_id, total_amount, customer_name } = details[0];
                const app = require('../app');
                const io = typeof app.get === 'function' ? app.get('io') : null;
                const notificationService = require('./notification.service');

                if (owner_id && io) {
                    await notificationService.createNotification(
                        io, business_id, owner_id, "Payment Received! 💰", 
                        `Payment of ₹${total_amount} received from ${customer_name} for Order #${orderId}.`
                    );
                }
            }
        } catch (nErr) { console.error("[Audit] Notification Error:", nErr.message); }

    } catch (error) {
        await connection.rollback();
        console.error(`[Audit] CRITICAL FAILURE for Order #${orderId}:`, error.message);
    } finally {
        connection.release();
    }
};

module.exports = {
    createCheckoutSession,
    handleStripeWebhook,
    handleRazorpayWebhook
};
