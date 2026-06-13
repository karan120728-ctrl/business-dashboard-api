const orderService = require("../services/order.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const AppError = require("../utils/AppError");

const createOrder = async (req, res) => {
    try {
        const { customer, products } = req.body;
        
        if (!customer || !products || products.length === 0) {
            throw new AppError("Customer and at least one product are required", 400);
        }

        const io = req.app.get("io");
        const order = await orderService.createOrder(req.user, req.user.business_id, { customer, products }, io);
        return sendSuccess(res, 201, { order }, "Order created successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const getOrders = async (req, res) => {
    try {
        const orders = await orderService.getOrders(req.user);
        return res.status(200).json(orders);
    } catch (error) {
        return sendError(res, error);
    }
};

const getOrderLocation = async (req, res) => {
    try {
        const location = await orderService.getOrderLocation(req.params.id, req.user.business_id);
        return res.json(location);
    } catch (error) {
        return sendError(res, error);
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) throw new AppError("Status is required", 400);

        const io = req.app.get("io");
        const result = await orderService.updateOrderStatus(req.params.id, req.user.business_id, status, io);
        return res.json({ message: "Order status updated", status: result.status });
    } catch (error) {
        return sendError(res, error);
    }
};

const assignDriver = async (req, res) => {
    try {
        const { driver_id, driver_name, vehicle_number } = req.body;
        if (!driver_id && !driver_name) {
            throw new AppError("Missing driver details", 400);
        }

        const io = req.app.get("io");
        await orderService.assignDriver(req.params.id, req.user.business_id, { driver_id, driver_name, vehicle_number }, io);
        return res.json({ message: "Driver assigned and order is out for delivery" });
    } catch (error) {
        return sendError(res, error);
    }
};

const updateLocation = async (req, res) => {
    try {
        const { delivery_location, address } = req.body;
        const lat = req.body.lat !== undefined ? req.body.lat : req.body.latitude;
        const lng = req.body.lng !== undefined ? req.body.lng : req.body.longitude;
        
        if (!delivery_location && (lat === undefined || lng === undefined)) {
            throw new AppError("Missing location coordinates", 400);
        }

        const result = await orderService.updateLocation(req.params.id, req.user.business_id, { delivery_location, lat, lng, address });
        
        // Emit live location update via Socket.io to the order room
        try {
            const io = req.app.get("io");
            if (io) {
                io.to(`order_${req.params.id}`).emit("locationUpdate", {
                    orderId: req.params.id,
                    delivery_location: result.location,
                    current_address: result.address
                });
            }
        } catch (socketErr) {
            console.error("[Socket.io] Error emitting location update:", socketErr.message);
        }

        return res.json({ message: "Location updated", location: result.location, address: result.address });
    } catch (error) {
        return sendError(res, error);
    }
};

const submitProof = async (req, res) => {
    try {
        const proof_image = req.file ? `/uploads/proofs/${req.file.filename}` : req.body.proof_image;
        if (!proof_image) {
            throw new AppError("No proof image provided", 400);
        }

        const io = req.app.get("io");
        await orderService.submitProof(req.params.id, req.user.business_id, proof_image, io);
        return res.json({ message: "Delivery confirmed and customer notified" });
    } catch (error) {
        return sendError(res, error);
    }
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
