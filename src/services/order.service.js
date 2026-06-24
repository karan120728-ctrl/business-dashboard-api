const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");
const { ORDER_STATUS } = require("../utils/constants");
const notificationService = require("./notification.service");
const invoiceService = require("./invoice.service");

const createOrder = async (user, businessId, data, io) => {
    const { customer, products } = data;
    const userId = user.id;

    // Security check: If role is customer, ensure they are ordering for themselves
    if (user.role === 'customer') {
        const [custRows] = await pool.query("SELECT id FROM customers WHERE email = ? AND business_id = ?", [user.email, businessId]);
        if (custRows.length === 0 || custRows[0].id != customer) {
            throw new AppError("You can only create orders for your own account", 403);
        }
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        let totalAmount = 0;
        let outOfStockItems = [];

        for (let item of products) {
            const [productRows] = await connection.query(
                "SELECT name, price, stock_quantity FROM products WHERE id = ? AND business_id = ? FOR UPDATE", 
                [item.product, businessId]
            );
            if (productRows.length === 0) {
                throw new AppError("Product not found in your business", 404);
            }
            
            // Deduct Stock
            await connection.query("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?", [item.quantity, item.product]);
            
            // Check Out of Stock Trigger
            if (productRows[0].stock_quantity - item.quantity < 0) {
                outOfStockItems.push(productRows[0].name);
            }
            
            totalAmount += productRows[0].price * item.quantity;
        }

        const [orderResult] = await connection.query(
            "INSERT INTO orders (business_id, customer_id, total_amount, created_by) VALUES (?, ?, ?, ?)",
            [businessId, customer, totalAmount, userId]
        );
        const orderId = orderResult.insertId;

        for (let item of products) {
            await connection.query(
                "INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
                [orderId, item.product, item.quantity]
            );
        }

        await connection.commit();

        // 🔥 Out of Stock Automations
        if (outOfStockItems.length > 0) {
            // If the user placing it is the customer (from mobile app), warn them
            if (user.role === 'customer') {
                io.to(`user_${user.id}`).emit('out_of_stock_warning', {
                    title: "Delivery Delayed ⚠️",
                    message: `You ordered ${outOfStockItems.join(', ')} which is currently out of stock. Your delivery will be delayed.`,
                    orderId: orderId
                });
                await notificationService.createNotification(io, businessId, user.id, "Delivery Delayed", `Your order includes items that are out of stock. Delivery will be delayed.`, 'info');
            } else {
                // If the user placing it is the admin, warn the admin internally
                io.to(`user_${userId}`).emit('notification', {
                    title: "Negative Stock Warning 🔴",
                    message: `You just promised ${outOfStockItems.join(', ')} to a customer, but you have zero stock left!`,
                    orderId: orderId
                });
            }
        }

        // 🔥 Notify Admin about the new order
        try {
            const [bRows] = await connection.query("SELECT owner_id FROM businesses WHERE id = ?", [businessId]);
            const [cRows] = await connection.query("SELECT name FROM customers WHERE id = ?", [customer]);
            if (bRows.length > 0 && cRows.length > 0 && bRows[0].owner_id) {
                const ownerId = bRows[0].owner_id;
                const customerName = cRows[0].name;
                await notificationService.createNotification(
                    io, 
                    businessId, 
                    ownerId, 
                    "New Order Received! 📦", 
                    `${customerName} just placed a new order (Order #${orderId}) for ₹${totalAmount}.`
                );
            }
        } catch (nErr) {
            console.error("[Notification] Error dispatching new order notification:", nErr.message);
        }

        // 🔥 REAL-TIME: Notify all admins in the business room
        if (io) {
            io.to(`business_${businessId}`).emit("newOrder", { 
                id: orderId, 
                customer_name: (await connection.query("SELECT name FROM customers WHERE id = ?", [customer]))[0][0]?.name,
                total_amount: totalAmount,
                status: 'pending'
            });
        }

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
    const businessId = user.business_id;
    let queryStr = `
        SELECT o.*,
               c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address as customer_address,
               u.name as created_by_name,
               (SELECT p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id LIMIT 1) as product_name,
               (SELECT oi.quantity FROM order_items oi WHERE oi.order_id = o.id LIMIT 1) as quantity,
               o.total_amount as total_price
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN users u ON o.created_by = u.id
        WHERE o.is_active = TRUE AND o.business_id = ?
    `;
    const params = [businessId];
    
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

const getOrderLocation = async (orderId, businessId) => {
    const [rows] = await pool.query(
        "SELECT id, status, delivery_location, current_address, driver_name, vehicle_number FROM orders WHERE id = ? AND business_id = ? AND is_active = TRUE",
        [orderId, businessId]
    );
    if (rows.length === 0) throw new AppError("Order not found", 404);
    return rows[0];
};

const updateOrderStatus = async (orderId, businessId, status, io) => {
    const [orderRows] = await pool.query("SELECT o.*, c.email FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ?", [orderId]);
    if (orderRows.length === 0) throw new AppError("Order not found", 404);
    const order = orderRows[0];

    // 🔥 AUTOMATION: Generate Invoice when officially marked as DELIVERED
    if (status === ORDER_STATUS.DELIVERED) {
        await invoiceService.createInvoice(businessId, orderId, order.customer_id, order.total_amount);
    }

    let query = "UPDATE orders SET status = ?";
    let params = [status];
    
    if (status === ORDER_STATUS.CONFIRMED) { query += ", packed_at = CURRENT_TIMESTAMP"; }
    else if (status === ORDER_STATUS.OUT_FOR_DELIVERY) { query += ", out_for_delivery_at = CURRENT_TIMESTAMP"; }
    else if (status === ORDER_STATUS.DELIVERED) { query += ", delivered_at = CURRENT_TIMESTAMP"; }
    
    query += " WHERE id = ? AND business_id = ?";
    params.push(orderId, businessId);

    const [result] = await pool.query(query, params);

    // 🚚 BATCH COMPLETION CHECK: If this order was part of a batch, check if the whole route is finished
    if (status === ORDER_STATUS.DELIVERED && order.batch_id) {
        const [remainingOrders] = await pool.query(
            "SELECT id FROM orders WHERE batch_id = ? AND status != ?",
            [order.batch_id, ORDER_STATUS.DELIVERED]
        );
        
        // If no orders left in this batch that aren't delivered
        if (remainingOrders.length === 0) {
            await pool.query(
                "UPDATE delivery_batches SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                [order.batch_id]
            );
            if (io) {
                io.to(`business_${businessId}`).emit("orderStatusChanged", { 
                    batchId: order.batch_id, 
                    type: 'batch_completed' 
                });
            }
        }
    }
    
    // Trigger Notification Event
    const [customerUserRows] = await pool.query("SELECT id FROM users WHERE email = ? AND role = 'customer' AND business_id = ?", [order.email, businessId]);
    if (customerUserRows.length > 0) {
        notificationService.createNotification(io, businessId, customerUserRows[0].id, "Order Update", `Your order #${order.id} is now ${status.replace(/_/g, ' ')}!`);
    }

    // 🔥 REAL-TIME: Notify rooms about status change
    if (io) {
        // Notify the specific order room (for tracking screen)
        io.to(`order_${orderId}`).emit("statusUpdate", { orderId, status });
        // Notify the business-wide room (for admin dashboard)
        io.to(`business_${businessId}`).emit("orderStatusChanged", { orderId, status });
    }

    return { status };
};

const assignDriver = async (orderId, businessId, data, io) => {
    const { driver_id, driver_name, vehicle_number } = data;

    const [result] = await pool.query(
        "UPDATE orders SET driver_id = ?, driver_name = ?, vehicle_number = ?, status = 'out_for_delivery', out_for_delivery_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?",
        [driver_id || null, driver_name, vehicle_number, orderId, businessId]
    );
    if (result.affectedRows === 0) throw new AppError("Order not found", 404);

    if (driver_id) {
        notificationService.createNotification(io, businessId, driver_id, "New Delivery Assigned 🚛", `You have been assigned order #${orderId}. Tap to start tracking!`);
    }

    // 🔥 REAL-TIME: Notifyrooms
    if (io) {
        io.to(`order_${orderId}`).emit("driverAssigned", { orderId, driver_name, vehicle_number, status: 'out_for_delivery' });
        io.to(`business_${businessId}`).emit("orderStatusChanged", { orderId, status: 'out_for_delivery' });
    }

    return true;
};

const updateLocation = async (orderId, businessId, data) => {
    const { delivery_location, lat, lng, address } = data;
    const locationStr = (lat && lng) ? `${lat},${lng}` : delivery_location;
    
    const [result] = await pool.query(
        "UPDATE orders SET delivery_location = ?, current_address = ? WHERE id = ? AND business_id = ?",
        [locationStr, address || null, orderId, businessId]
    );
    if (result.affectedRows === 0) throw new AppError("Order not found", 404);
    
    return { location: locationStr, address };
};

const submitProof = async (orderId, businessId, proofImage, io) => {
    const [result] = await pool.query(
        "UPDATE orders SET proof_image_url = ? WHERE id = ? AND business_id = ?",
        [proofImage, orderId, businessId]
    );
    if (result.affectedRows === 0) throw new AppError("Order not found", 404);

    const [orderRows] = await pool.query("SELECT o.*, c.email FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = ?", [orderId]);
    if (orderRows.length > 0) {
        const order = orderRows[0];
        
        // 🚀 AUTOMATION: Auto-update status to Delivered (triggering Invoice generation)
        await updateOrderStatus(orderId, businessId, ORDER_STATUS.DELIVERED, io);

        const [customerUserRows] = await pool.query("SELECT id FROM users WHERE email = ? AND role = 'customer' AND business_id = ?", [order.email, businessId]);
        if (customerUserRows.length > 0) {
            notificationService.createNotification(io, businessId, customerUserRows[0].id, "Order Delivered! 📦", `Your order #${order.id} has been securely delivered. You can view the proof of delivery in your dashboard.`);
        }
        
        // Also notify Admin
        const [busRows] = await pool.query("SELECT owner_id FROM businesses WHERE id = ?", [businessId]);
        if (busRows.length > 0 && busRows[0].owner_id) {
            notificationService.createNotification(io, businessId, busRows[0].owner_id, "Delivery Completed ✅", `Order #${orderId} was successfully delivered and an invoice was generated.`);
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
