const Customer = require("../models/customer.model");

// CREATE CUSTOMER
const createCustomer = async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;

        // 1️⃣ Basic validation
        if (!name || !email || !phone) {
            return res.status(400).json({
                message: "Name, email and phone are required"
            });
        }

        // 2️⃣ Check duplicate customer
        const existingCustomer = await Customer.findOne({ email });
        if (existingCustomer) {
            return res.status(400).json({
                message: "Customer already exists"
            });
        }

        // 3️⃣ Create customer
        const customer = await Customer.create({
            name,
            email,
            phone,
            address
        });

        res.status(201).json(customer);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET ALL CUSTOMERS
const getCustomers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const search = req.query.search || "";

        const query = {
            isActive: true,
            name: { $regex: search, $options: "i" }
        };

        if (req.user.role === "admin" && req.query.showDeleted === "true") {
            delete query.isActive;
        }


        const customers = await Customer.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Customer.countDocuments(query);

        res.status(200).json({
            page,
            limit,
            total,
            customers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// UPDATE CUSTOMER
const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, address, isActive } = req.body;

        // 1️⃣ Find customer
        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        // 2️⃣ Update only provided fields
        if (name !== undefined) customer.name = name;
        if (email !== undefined) customer.email = email;
        if (phone !== undefined) customer.phone = phone;
        if (address !== undefined) customer.address = address;
        if (isActive !== undefined) customer.isActive = isActive;

        // 3️⃣ Save updated customer
        await customer.save();

        res.status(200).json({
            message: "Customer updated successfully",
            customer
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// SOFT DELETE CUSTOMER
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        customer.isActive = false;
        await customer.save();

        res.json({ message: "Customer soft-deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const restoreCustomer = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            { isActive: true },
            { new: true }
        );

        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }

        res.json({ message: "Customer restored", customer });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};




module.exports = {
    createCustomer,
    getCustomers,
    updateCustomer,
    deleteCustomer,
    restoreCustomer
};
