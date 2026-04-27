const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const createProduct = async (businessId, data) => {
    const { name, price, description } = data;

    const [existing] = await pool.query("SELECT id FROM products WHERE name = ? AND business_id = ?", [name, businessId]);
    if (existing.length > 0) {
        throw new AppError("Product already exists in your business", 400);
    }

    const [result] = await pool.query(
        "INSERT INTO products (business_id, name, price, description) VALUES (?, ?, ?, ?)",
        [businessId, name, price, description || null]
    );

    return {
        id: result.insertId,
        name,
        price,
        description,
        isActive: true
    };
};

const getAllProducts = async (businessId, searchQuery) => {
    let query = "SELECT * FROM products WHERE is_active = TRUE AND business_id = ?";
    let params = [businessId];
    
    if (searchQuery) {
        query += " AND name LIKE ?";
        params.push(`%${searchQuery}%`);
    }
    
    query += " ORDER BY created_at DESC";
    
    const [products] = await pool.query(query, params);
    return products;
};

const deleteProduct = async (id, businessId) => {
    const [result] = await pool.query("UPDATE products SET is_active = FALSE WHERE id = ? AND business_id = ?", [id, businessId]);
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
