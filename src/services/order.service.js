const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");
const { ORDER_STATUS } = require("../utils/constants");
const notificationService = require("./notification.service");

const createOrder = async (userId, data, io) => {
    const { customer, products } = data;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        let totalAmount = 0;
        for (let item of products) {
            const [productRows] = await connection.query("SELECT price FROM products WHERE id = ?", [item.product]);
            if (productRows.length === 0) {
                throw new AppError("Product not found", 404);
            }
            totalAmount += productRows[0].price * item.quantity;
        }

        const [orderResult] = await connection.query(
            "INSERT INTO orders (customer_id, total_amount, created_by) VALUES (?, ?, ?)",
            [customer, totalAmount, userId]
        );
        const orderId = orderResult.insertId;

        for (let item of products) {
            await connection.query(
                "INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
                [orderId, item.product, item.quantity]
            );
        }

        await connection.commit();
        return { id: orderId, customer_id: customer, totalAmount, createdBy: userId };
    } catch (error) {
        await connection.rollback();
        if (error instanceof AppError) throw error;
        throw new AppError("Database error during order creation: " + error.message, 500);
    } finally {
        connection.release();
    }
};

const getOrders = async (user) => {
    let queryStr = `
        SELECT o.*,
               c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address as customer_address,
               u.name as created_by_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN users u ON o.created_by = u.id
        WHERE o.is_active = TRUE
    `;
    const params = [];
    
    if (user.role === "driver") {
        queryStr += " AND o.driver_id = ?";
        params.push(user.id);
    } else if (user.role === "customer") {
        queryStr += " AND c.email = ?";
        params.push(user.email);
    } else if (user.role !== "admin" && user.role !== "superadmin") {
        queryStr += " AND o.created_by = ?";
        params.push(user.id);
    }
    
    queryStr += " ORDER BY o.created_at DESC";
    
    const [orders] = await pool.query(queryStr, params);
    return orders;
};

const getOrderLocation = async (orderId) => {
    const [rows] = await pool.query(
        "SELECT id, status, delivery_location, current_address, driver_name, vehicle_number FROM orders WHERE id = ? AND is_active = TRUE",
        [orderId]
    );
    if (rows.length === 0) throw new AppError("Order not found", 404);
    return rows[0];
};

const updateOrderStatus = async (orderId, status, io) => {
    const allowedStatus = Object.values(ORDER_STATUS);
    if (!allowedStatus.includes(status)) throw new AppError("Invalid status", 400);

    let query = "UPDATE orders SET status = ?";
    let params = [status];
    
    if (status === ORDER_STATUS.CONFIRMED) { query += ", packed_at = CURRENT_TIMESTAMP"; }
    else if (status === ORDER_STATUS.OUT_FOR_DELIVERY) { query += ", out_for_delivery_at = CURRENT_TIMESTAMP"; }
    else if (status === ORDER_STATUS.DELIVERED) { query += ", delivered_at = CURRENT_TIMESTAMP"; }
    
    query += " WHERE id = ?";
    params.push(orderId);

    const [result] = await pool.query(query, params);
    if (result.affectedRows === 0) throw new AppError("Order not found", 404);

    // Trigger Notification Event
    const [orderRows] = await pool.query("SELECT o.*, c.email FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ?", [orderId]);
    if (orderRows.length > 0) {
        const order = orderRows[0];
        const [customerUserRows] = await pool.query("SELECT id FROM users WHERE email = ? AND role = 'customer'", [order.email]);
        if (customerUserRows.length > 0) {
            notificationService.createNotification(io, customerUserRows[0].id, "Order Update", `Your order #${order.id} is now ${status.replace(/_/g, ' ')}!`);
        }
    }

    return { status };
};

const assignDriver = async (orderId, data, io) => {
    const { driver_id, driver_name, vehicle_number } = data;

    const [result] = await pool.query(
        "UPDATE orders SET driver_id = ?, driver_name = ?, vehicle_number = ?, status = 'out_for_delivery', out_for_delivery_at = CURRENT_TIMESTAMP WHERE id = ?",
        [driver_id || null, driver_name, vehicle_number, orderId]
    );
    if (result.affectedRows === 0) throw new AppError("Order not found", 404);

    if (driver_id) {
        notificationService.createNotification(io, driver_id, "New Delivery Assigned 🚛", `You have been assigned order #${orderId}. Tap to start tracking!`);
    }

    return true;
};

const updateLocation = async (orderId, data) => {
    const { delivery_location, lat, lng, address } = data;
    const locationStr = (lat && lng) ? `${lat},${lng}` : delivery_location;
    
    const [result] = await pool.query(
        "UPDATE orders SET delivery_location = ?, current_address = ? WHERE id = ?",
        [locationStr, address || null, orderId]
    );
    if (result.affectedRows === 0) throw new AppError("Order not found", 404);
    
    return { location: locationStr, address };
};

const submitProof = async (orderId, proofImage, io) => {
    const [result] = await pool.query(
        "UPDATE orders SET proof_image_url = ?, status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ?",
        [proofImage, orderId]
    );
    if (result.affectedRows === 0) throw new AppError("Order not found", 404);

    const [orderRows] = await pool.query("SELECT o.*, c.email FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ?", [orderId]);
    if (orderRows.length > 0) {
        const order = orderRows[0];
        const [customerUserRows] = await pool.query("SELECT id FROM users WHERE email = ? AND role = 'customer'", [order.email]);
        if (customerUserRows.length > 0) {
            notificationService.createNotification(io, customerUserRows[0].id, "Package Delivered! ✅", `Order #${order.id} has been successfully delivered. Thank you!`);
        }
    }

    return true;
};

module.exports = {
    createOrder,
    getOrders,
    getOrderLocation,
    updateOrderStatus,
    assignDriver,
    updateLocation,
    submitProof
};
