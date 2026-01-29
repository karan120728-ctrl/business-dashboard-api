const Order = require("../models/order.model");
const Product = require("../models/product.model");

const createOrder = async (req, res) => {
    try {
        const { customer, products } = req.body;

        let totalAmount = 0;

        // calculate total price
        for (let item of products) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({ message: "Product not found" });
            }
            totalAmount += product.price * item.quantity;
        }

        const order = await Order.create({
            customer,
            products,
            totalAmount,
            createdBy: req.user.id, // from token
        });

        res.status(201).json({
            message: "Order created successfully",
            order,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getOrders = async (req, res) => {
    try {
        const query = { isActive: true };

        // if user, restrict orders
        if (req.user.role !== "admin") {
            query.createdBy = req.user.id;
        }

        const orders = await Order.find(query)
            .populate("customer", "name email phone")
            .populate("products.product", "name price")
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const updateOrderStatus = async (req, res) => {
    try {
        const { status, payment } = req.body;

        const allowedStatus = ["pending", "paid", "shipped", "delivered", "cancelled"];
        if (!allowedStatus.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // 🟢 Payment success → reduce stock ONCE
        if (order.status !== "paid" && status === "paid") {
            for (const item of order.products) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: -item.quantity } }
                );
            }

            order.payment = {
                method: payment?.method,
                transactionId: payment?.transactionId,
                paidAt: new Date()
            };
        }

        // 🔴 Cancel paid order → restore stock
        if (order.status === "paid" && status === "cancelled") {
            for (const item of order.products) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: item.quantity } }
                );
            }
        }

        order.status = status;
        await order.save();

        res.json({ message: "Order status updated", order });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSalesSummary = async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments({ isActive: true });

        const revenue = await Order.aggregate([
            { $match: { status: "paid", isActive: true } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalAmount" }
                }
            }
        ]);

        const statusWise = await Order.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            totalOrders,
            totalRevenue: revenue[0]?.totalRevenue || 0,
            statusWise
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const getMonthlySales = async (req, res) => {
    try {
        const sales = await Order.aggregate([
            {
                $match: {
                    status: "paid",
                    isActive: true
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    totalSales: { $sum: "$totalAmount" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


module.exports = { createOrder, getOrders, updateOrderStatus, getSalesSummary, getMonthlySales };
