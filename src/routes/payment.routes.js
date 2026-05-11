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

// 3. Razorpay Webhook
router.post('/webhook/razorpay', async (req, res) => {
    console.log("[Webhook] Razorpay signal received!");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'flowops_secret_2026';
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify signature using RAW body
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

    console.log("[Webhook] Expected Signature:", expectedSignature);
    console.log("[Webhook] Received Signature:", signature);

    if (signature !== expectedSignature) {
        console.error("[Webhook] Razorpay Invalid Signature detected!");
        return res.status(400).send('Invalid Signature');
    }

    console.log("[Webhook] Signature Verified! Processing payload...");
    await paymentService.handleRazorpayWebhook(req.body);
    res.json({ status: 'ok' });
});

module.exports = router;
