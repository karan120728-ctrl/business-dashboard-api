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
    const currency = order.currency || 'INR'; // Default to INR for local context
    
    // 2. Determine Gateway
    if (currency === 'INR') {
        // --- RAZORPAY FLOW ---
        if (!razorpay) {
            throw new AppError("Razorpay is not configured by the administrator.", 500);
        }
        const paymentLink = await razorpay.paymentLink.create({
            amount: Math.round(order.total_amount * 100), // In Paise
            currency: "INR",
            accept_partial: false,
            description: `Order #${order.id} - Logistics Services`,
            customer: {
                name: order.customer_name,
                email: order.customer_email,
                contact: "" // Add phone if available
            },
            notify: {
                sms: false,
                email: true
            },
            reminder_enable: true,
            notes: {
                orderId: order.id.toString(),
                businessId: businessId.toString()
            },
            callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard.html?status=success&orderId=${order.id}`,
            callback_method: "get"
        });

        return paymentLink.short_url;
    } else {
        // --- STRIPE FLOW ---
        if (!stripe) {
            throw new AppError("Stripe is not configured by the administrator.", 500);
        }
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: `Order #${order.id} - Logistics Services`,
                        },
                        unit_amount: Math.round(order.total_amount * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard.html?status=success&orderId=${order.id}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/dashboard.html?status=cancelled`,
            metadata: {
                orderId: order.id.toString(),
                businessId: businessId.toString()
            }
        });

        return session.url;
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

const handleRazorpayWebhook = async (payload) => {
    // Razorpay sends 'payment_link.paid' event
    if (payload.event === 'payment_link.paid') {
        const { orderId } = payload.payload.payment_link.entity.notes;
        await markOrderAsPaid(orderId);
    }
};

const markOrderAsPaid = async (orderId) => {
    await pool.query(
        "UPDATE orders SET payment_status = 'paid' WHERE id = ?",
        [orderId]
    );
    console.log(`✅ Order #${orderId} marked as PAID via Gateway Webhook`);
};

module.exports = {
    createCheckoutSession,
    handleStripeWebhook,
    handleRazorpayWebhook
};
