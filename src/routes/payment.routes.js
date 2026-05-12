const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment.service');
const protect = require('../middlewares/auth.middleware');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const crypto = require('crypto');

// 1. Create Checkout Session (Protected)
router.post('/create-session/:orderId', protect, async (req, res, next) => {
    try {
        const checkoutUrl = await paymentService.createCheckoutSession(
            req.params.orderId,
            req.user.business_id
        );
        res.json({ status: 'success', url: checkoutUrl });
    } catch (error) {
        next(error);
    }
});

// 2. Create Session from Public Token (Guest Checkout)
router.post('/pay-invoice/:token', async (req, res, next) => {
    try {
        const checkoutUrl = await paymentService.createSessionFromToken(req.params.token);
        res.json({ status: 'success', url: checkoutUrl });
    } catch (error) {
        next(error);
    }
});

// 2. Stripe Webhook
router.post('/webhook/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    await paymentService.handleStripeWebhook(event);
    res.json({ received: true });
});

// 4. Razorpay Webhook
router.post('/webhook/razorpay', async (req, res) => {
    await paymentService.handleRazorpayWebhook(req, res);
});

module.exports = router;

// 5. Secret Manual Sync (For Testing/Fail-safe)
router.get('/force-sync/:orderId', async (req, res) => {
    const secret = req.query.secret;
    if (secret !== 'flowops_sync_2026') return res.status(403).send('Forbidden');
    
    try {
        await paymentService.markOrderAsPaid(req.params.orderId);
        res.send(`✅ Order #${req.params.orderId} forced to PAID successfully!`);
    } catch (e) {
        res.status(500).send(`❌ Sync Failed: ${e.message}`);
    }
});

// 6. Audit Viewer (For Debugging)
router.get('/audit-view', async (req, res) => {
    const secret = req.query.secret;
    if (secret !== 'flowops_sync_2026') return res.status(403).send('Forbidden');
    
    try {
        const [logs] = await pool.query("SELECT * FROM payment_audit_logs ORDER BY created_at DESC LIMIT 10");
        res.json(logs);
    } catch (e) {
        res.status(500).send(`❌ Audit View Failed: ${e.message}`);
    }
});

module.exports = router;
