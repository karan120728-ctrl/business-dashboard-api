const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

const sendOTPEmail = async (toEmail, otp, userName) => {
    const user = process.env.EMAIL_USER;
    const apiKey = process.env.SENDGRID_API_KEY;
    const smtpPass = process.env.EMAIL_PASS;

    // --- APPROACH A: SendGrid API (Preferred for Cloud/Render) ---
    if (apiKey) {
        console.log('📨 Using SendGrid API for reliable delivery...');
        sgMail.setApiKey(apiKey);
        const msg = {
            to: toEmail,
            from: user, // Must be a verified sender in SendGrid
            subject: `Your FlowOps OTP Code: ${otp}`,
            html: getEmailTemplate(otp, userName),
        };

        try {
            await sgMail.send(msg);
            console.log('✅ OTP Email sent via SendGrid to:', toEmail);
            return { success: true };
        } catch (error) {
            console.error('❌ SendGrid Error:', error.response ? error.response.body : error.message);
            throw new Error("Failed to send email via API. Please check SendGrid settings.");
        }
    }

    // --- APPROACH B: SMTP Fallback (For local testing) ---
    console.log('📨 Using SMTP Fallback...');
    if (!user || !smtpPass) {
        throw new Error("Email service not configured. Please add SENDGRID_API_KEY or EMAIL_PASS.");
    }

    const pass = smtpPass.replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass },
        family: 4,
        connectionTimeout: 15000
    });

    const mailOptions = {
        from: `"FlowOps Security" <${user}>`,
        to: toEmail,
        subject: `Your FlowOps OTP Code: ${otp}`,
        html: getEmailTemplate(otp, userName)
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ OTP Email sent via SMTP to:', toEmail);
        return { success: true };
    } catch (error) {
        console.error('❌ SMTP Error:', error.message);
        throw new Error("Failed to send OTP email: " + error.message);
    }
};

function getEmailTemplate(otp, userName) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #4f46e5; margin: 0;">FlowOps</h2>
            <p style="color: #64748b; font-size: 14px;">Secure Password Reset</p>
        </div>
        <div style="background: white; border-radius: 10px; padding: 24px; border: 1px solid #e2e8f0;">
            <p style="color: #1e293b; font-size: 16px; margin-top: 0;">Hi <strong>${userName || 'there'}</strong>,</p>
            <p style="color: #475569; font-size: 14px;">We received a request to reset your FlowOps password. Use the OTP below to proceed:</p>
            
            <div style="text-align: center; margin: 28px 0;">
                <div style="display: inline-block; background: #eef2ff; border: 2px dashed #4f46e5; border-radius: 10px; padding: 16px 32px;">
                    <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4f46e5;">${otp}</span>
                </div>
            </div>
            
            <p style="color: #ef4444; font-size: 13px; text-align: center;">⏱ This OTP expires in <strong>10 minutes</strong>.</p>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-bottom: 0;">If you didn't request this, please ignore this email. Your account is safe.</p>
        </div>
        <p style="color: #cbd5e1; font-size: 11px; text-align: center; margin-top: 20px;">© FlowOps — Logistics & Payment Platform</p>
    </div>
    `;
}

const sendTransactionalEmail = async (toEmail, subject, htmlContent) => {
    const user = process.env.EMAIL_USER;
    const apiKey = process.env.SENDGRID_API_KEY;
    const smtpPass = process.env.EMAIL_PASS;

    if (apiKey) {
        sgMail.setApiKey(apiKey);
        try {
            await sgMail.send({ to: toEmail, from: user, subject, html: htmlContent });
            console.log(`✅ Transactional Email sent via SendGrid to: ${toEmail}`);
            return true;
        } catch (error) {
            console.error('❌ SendGrid Error:', error.message);
            return false;
        }
    }

    if (user && smtpPass) {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', port: 587, secure: false,
            auth: { user, pass: smtpPass.replace(/\s+/g, '') }
        });
        try {
            await transporter.sendMail({ from: `"FlowOps Notifications" <${user}>`, to: toEmail, subject, html: htmlContent });
            console.log(`✅ Transactional Email sent via SMTP to: ${toEmail}`);
            return true;
        } catch (error) {
            console.error('❌ SMTP Error:', error.message);
            return false;
        }
    }
    console.log(`⚠️ Email sending skipped (No credentials configured) for: ${toEmail}`);
    return false;
};

module.exports = { sendOTPEmail, sendTransactionalEmail };
