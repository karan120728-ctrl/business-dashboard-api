const { pool } = require("../db/connection");
const AppError = require("../utils/AppError");
const notificationService = require("./notification.service");
const { ORDER_STATUS } = require("../utils/constants");

const createBatch = async (businessId, adminId, data, io) => {
    const { driver_id, order_ids } = data; // order_ids is an array of IDs

    if (!driver_id || !order_ids || order_ids.length === 0) {
        throw new AppError("Driver ID and at least one Order ID are required", 400);
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create the Batch
        const [batchResult] = await connection.query(
            "INSERT INTO delivery_batches (business_id, driver_id, status) VALUES (?, ?, 'pending')",
            [businessId, driver_id]
        );
        const batchId = batchResult.insertId;

        // 2. Assign all selected orders to this batch and to this driver
        const placeholders = order_ids.map(() => "?").join(",");
        const query = `
            UPDATE orders 
            SET batch_id = ?, driver_id = ?, status = ?
            WHERE id IN (${placeholders}) AND business_id = ?
        `;
        const params = [batchId, driver_id, ORDER_STATUS.CONFIRMED, ...order_ids, businessId];
        await connection.query(query, params);

        await connection.commit();

        // 3. Notify the Driver
        io.to(`user_${driver_id}`).emit('notification', {
            title: "New Delivery Route Attached",
            message: `You have been assigned a batch of ${order_ids.length} orders. Check your Batch tab!`,
            batchId: batchId
        });
        await notificationService.createNotification(io, businessId, driver_id, "New Route Assigned", `You have been assigned a new delivery route with ${order_ids.length} stops.`, 'info');

        return { batchId, driverId: driver_id, orderCount: order_ids.length };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const getDriverBatches = async (driverId, businessId) => {
    // Get all batches for a driver, along with a count of total orders and completed orders
    const [batches] = await pool.query(`
        SELECT b.*, 
               (SELECT COUNT(id) FROM orders WHERE batch_id = b.id) as total_orders,
               (SELECT COUNT(id) FROM orders WHERE batch_id = b.id AND status = 'delivered') as completed_orders
        FROM delivery_batches b
        WHERE b.driver_id = ? AND b.business_id = ?
        ORDER BY b.created_at DESC
    `, [driverId, businessId]);

    // 🔥 SELF-HEALING: Auto-fix any batches that were delivered before the trigger was added
    for (const batch of batches) {
        if (batch.total_orders > 0 && batch.total_orders === batch.completed_orders && batch.status !== 'completed') {
            await pool.query("UPDATE delivery_batches SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", [batch.id]);
            batch.status = 'completed'; // Update local object for immediate UI response
        }
    }

    return batches;
};

const getBatchDetails = async (batchId, businessId) => {
    // Get the orders inside the batch
    const [orders] = await pool.query(`
        SELECT o.id, o.customer_id, o.status, o.delivery_location, o.current_address, 
               c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.batch_id = ? AND o.business_id = ?
    `, [batchId, businessId]);
    return orders;
}

module.exports = {
    createBatch,
    getDriverBatches,
    getBatchDetails
};
