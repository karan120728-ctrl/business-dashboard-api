const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,
    socketTimeout: 15000
});

// Verify connection on startup
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter.verify((error, success) => {
        if (error) {
            console.error('📧 Email Service Error:', error.message);
        } else {
            console.log('📧 Email Service is ready to send messages');
        }
    });
}

const sendOTPEmail = async (toEmail, otp, userName) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error("❌ Email credentials missing in .env file!");
        throw new Error("Email service is not configured on the server.");
    }

    const mailOptions = {
        from: `"FlowOps Security" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Your FlowOps OTP Code: ${otp}`,
        html: `
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
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ OTP Email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Failed to send OTP email:', error.message);
        throw new Error("Failed to send email. Please check server logs.");
    }
};

module.exports = { sendOTPEmail };
