const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const createCustomer = async (data) => {
    const { name, email, phone, address } = data;

    const [existing] = await pool.query("SELECT id FROM customers WHERE email = ?", [email]);
    if (existing.length > 0) {
        throw new AppError("Customer already exists", 400);
    }

    const [result] = await pool.query(
        "INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)",
        [name, email, phone, address || null]
    );

    return {
        id: result.insertId,
        name,
        email,
        phone,
        address,
        isActive: true
    };
};

const getAllCustomers = async (searchQuery) => {
    let query = "SELECT * FROM customers WHERE is_active = TRUE";
    let params = [];
    
    if (searchQuery) {
        query += " AND (name LIKE ? OR email LIKE ?)";
        params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }
    
    query += " ORDER BY created_at DESC";
    
    const [customers] = await pool.query(query, params);
    return customers;
};

const deleteCustomer = async (id) => {
    const [result] = await pool.query("UPDATE customers SET is_active = FALSE WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
        throw new AppError("Customer not found", 404);
    }
    return true;
};

module.exports = {
    createCustomer,
    getAllCustomers,
    deleteCustomer
};
