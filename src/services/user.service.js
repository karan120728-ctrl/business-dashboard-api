const { pool } = require("../db/connection");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

const createUser = async (userData) => {
    const { name, email, password, role } = userData;

    // Check duplicate
    const [existingUser] = await pool.query("SELECT id FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    if (existingUser.length > 0) {
        throw new AppError("Email already registered", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let userRole = role || 'customer';
    if (userRole === 'user') userRole = 'customer';

    const [result] = await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email.toLowerCase(), hashedPassword, userRole]
    );

    return {
        id: result.insertId,
        name,
        email,
        role: userRole
    };
};

const loginUser = async (email, password) => {
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    const user = users[0];
    
    if (!user) throw new AppError("Invalid credentials", 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid credentials", 401);

    const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    return {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
    };
};

const getAllUsers = async () => {
    const [users] = await pool.query("SELECT id, name, email, role, is_active, created_at FROM users");
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

module.exports = {
    createUser,
    loginUser,
    getAllUsers,
    updateUser
};
