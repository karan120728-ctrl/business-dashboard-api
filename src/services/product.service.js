const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");

const createProduct = async (businessId, data) => {
    const { name, price, description, stock_quantity = 0, unit_size = null } = data;

    const [existing] = await pool.query("SELECT id FROM products WHERE name = ? AND business_id = ?", [name, businessId]);
    if (existing.length > 0) {
        throw new AppError("Product already exists in your business", 400);
    }

    const [result] = await pool.query(
        "INSERT INTO products (business_id, name, price, description, stock_quantity, unit_size) VALUES (?, ?, ?, ?, ?, ?)",
        [businessId, name, price, description || null, stock_quantity, unit_size]
    );

    return {
        id: result.insertId,
        name,
        price,
        stock_quantity,
        unit_size,
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

const updateProductDetails = async (id, businessId, updates) => {
    // Only allow updating stock, price, and description easily
    const fields = [];
    const params = [];
    if (updates.price !== undefined) { fields.push('price = ?'); params.push(updates.price); }
    if (updates.stock_quantity !== undefined) { fields.push('stock_quantity = ?'); params.push(updates.stock_quantity); }
    if (updates.unit_size !== undefined) { fields.push('unit_size = ?'); params.push(updates.unit_size); }

    if (fields.length === 0) return true; // nothing to pull

    params.push(id, businessId);
    const [result] = await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ? AND business_id = ?`, params);
    
    if (result.affectedRows === 0) throw new AppError("Product not found", 404);
    return true;
};

module.exports = {
    createProduct,
    getAllProducts,
    deleteProduct,
    updateProductDetails
};
