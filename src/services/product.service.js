const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const createProduct = async (data) => {
    const { name, price, description } = data;

    const [existing] = await pool.query("SELECT id FROM products WHERE name = ?", [name]);
    if (existing.length > 0) {
        throw new AppError("Product already exists", 400);
    }

    const [result] = await pool.query(
        "INSERT INTO products (name, price, description) VALUES (?, ?, ?)",
        [name, price, description || null]
    );

    return {
        id: result.insertId,
        name,
        price,
        description,
        isActive: true
    };
};

const getAllProducts = async (searchQuery) => {
    let query = "SELECT * FROM products WHERE is_active = TRUE";
    let params = [];
    
    if (searchQuery) {
        query += " AND name LIKE ?";
        params.push(`%${searchQuery}%`);
    }
    
    query += " ORDER BY created_at DESC";
    
    const [products] = await pool.query(query, params);
    return products;
};

const deleteProduct = async (id) => {
    const [result] = await pool.query("UPDATE products SET is_active = FALSE WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
        throw new AppError("Product not found", 404);
    }
    return true;
};

module.exports = {
    createProduct,
    getAllProducts,
    deleteProduct
};
