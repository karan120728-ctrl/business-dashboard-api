const { pool } = require("../db/connection");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const AppError = require("../utils/AppError");
const { sendOTPEmail } = require("../utils/emailService");

const createUser = async (userData) => {
    const { name, email, password, role, businessName, businessCode, phone } = userData;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Check duplicate
        const [existingUser] = await connection.query("SELECT id FROM users WHERE email = ?", [email.trim().toLowerCase()]);
        if (existingUser.length > 0) {
            throw new AppError("Email already registered", 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let userRole = role || 'customer';
        let businessId = null;

        // 1. Handle Business Context
        if (userRole === 'admin') {
            if (!businessName) throw new AppError("Business name is required for Admin registration", 400);
            
            // Create Business
            const bCode = `FLOW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            const [bResult] = await connection.query(
                "INSERT INTO businesses (name, business_code) VALUES (?, ?)",
                [businessName, bCode]
            );
            businessId = bResult.insertId;
        } else {
            // Drivers/Customers join existing business
            if (!businessCode) throw new AppError("Business code is required to join a company", 400);
            const [businesses] = await connection.query("SELECT id FROM businesses WHERE business_code = ?", [businessCode]);
            if (businesses.length === 0) throw new AppError("Invalid business code", 400);
            businessId = businesses[0].id;
        }

        // 2. Create User
        const [result] = await connection.query(
            "INSERT INTO users (business_id, name, email, password, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
            [businessId, name, email.toLowerCase(), hashedPassword, userRole, phone || null]
        );
        const userId = result.insertId;

        // 3. Update Business owner if Admin
        if (userRole === 'admin') {
            await connection.query("UPDATE businesses SET owner_id = ? WHERE id = ?", [userId, businessId]);
        }

        // 4. Auto-create a Customer profile when role is customer
        //    This allows them to place orders via openOrderModal() immediately
        if (userRole === 'customer') {
            await connection.query(
                "INSERT IGNORE INTO customers (business_id, name, email, phone) VALUES (?, ?, ?, ?)",
                [businessId, name, email.toLowerCase(), null]
            );
        }

        await connection.commit();
        
        // Fetch the generated code for the response if admin
        const [finalBus] = await connection.query("SELECT business_code FROM businesses WHERE id = ?", [businessId]);

        return {
            id: userId,
            name,
            email,
            role: userRole,
            businessCode: finalBus[0]?.business_code
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const loginUser = async (email, password) => {
    const [users] = await pool.query(`
        SELECT u.*, b.business_code, c.id as customer_id
        FROM users u 
        LEFT JOIN businesses b ON u.business_id = b.id 
        LEFT JOIN customers c ON u.email = c.email AND u.business_id = c.business_id
        WHERE u.email = ?
    `, [email.trim().toLowerCase()]);
    
    const user = users[0];
    
    if (!user) throw new AppError("Invalid credentials", 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid credentials", 401);

    const token = jwt.sign(
        { id: user.id, role: user.role, business_id: user.business_id, email: user.email },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    return {
        token,
        user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role, 
            business_id: user.business_id,
            inviteCode: user.business_code,
            customerId: user.customer_id
        }
    };
};

const forgotPassword = async (email) => {
    const [users] = await pool.query("SELECT id, name FROM users WHERE email = ?", [email.toLowerCase()]);
    if (users.length === 0) throw new AppError("No user found with this email", 404);

    const user = users[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP hash in reset fields
    await pool.query(
        "UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE id = ?",
        [otpHash, expires, user.id]
    );

    // Send OTP via email
    await sendOTPEmail(email, otp, user.name);

    return true;
};

const resetPassword = async (otp, email, newPassword) => {
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    
    const [users] = await pool.query(
        "SELECT id FROM users WHERE email = ? AND reset_token_hash = ? AND reset_expires > CURRENT_TIMESTAMP",
        [email.toLowerCase(), otpHash]
    );

    if (users.length === 0) throw new AppError("OTP is invalid or has expired", 400);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
        "UPDATE users SET password = ?, reset_token_hash = NULL, reset_expires = NULL WHERE id = ?",
        [hashedPassword, users[0].id]
    );

    return true;
};

const getAllUsers = async (businessId) => {
    const [users] = await pool.query(
        "SELECT id, business_id, name, email, role, is_active, created_at FROM users WHERE business_id = ? AND role != 'superadmin'",
        [businessId]
    );
    return users;
};

const updateUser = async (id, updateData) => {
    const { role, is_active } = updateData;
    const [result] = await pool.query(
        "UPDATE users SET role = COALESCE(?, role), is_active = COALESCE(?, is_active) WHERE id = ?",
        [role, is_active, id]
    );
    if (result.affectedRows === 0) throw new AppError("User not found", 404);
    return true;
};

const updatePushToken = async (userId, pushToken) => {
    await pool.query(
        "UPDATE users SET push_token = ? WHERE id = ?",
        [pushToken, userId]
    );
    return true;
};

module.exports = {
    createUser,
    loginUser,
    forgotPassword,
    resetPassword,
    getAllUsers,
    updateUser,
    updatePushToken
};
