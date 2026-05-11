const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const { pool } = require('../db/connection');
const AppError = require('../utils/AppError');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createCheckoutSession = async (orderId, businessId) => {
    // 1. Fetch order details
    const [orders] = await pool.query(
        "SELECT o.*, p.name as product_name, u.email as customer_email, u.name as customer_name FROM orders o JOIN products p ON o.product_id = p.id JOIN users u ON o.customer_id = u.id WHERE o.id = ? AND o.business_id = ?",
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
        const paymentLink = await razorpay.paymentLink.create({
            amount: Math.round(order.total_amount * 100), // In Paise
            currency: "INR",
            accept_partial: false,
            description: `Order #${order.id} - ${order.product_name}`,
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
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: `Order #${order.id} - ${order.product_name}`,
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
