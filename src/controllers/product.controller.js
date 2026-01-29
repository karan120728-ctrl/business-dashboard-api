const Product = require("../models/product.model");

// CREATE PRODUCT
const createProduct = async (req, res) => {
    try {
        const { name, price, description } = req.body;

        const existingProduct = await Product.findOne({ name });
        if (existingProduct) {
            return res.status(400).json({ message: "Product already exists" });
        }

        const product = await Product.create({
            name,
            price,
            description,
        });

        res.status(201).json({
            message: "Product created successfully",
            product,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET PRODUCTS (pagination + search + active only)
const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        const query = {
            isActive: true,
            name: { $regex: search, $options: "i" }
        };

        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Product.countDocuments(query);

        res.status(200).json({ page, limit, total, products });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.json({ message: "Product updated", product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        res.json({ message: "Product deleted", product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const restoreProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isActive: true },
            { new: true }
        );

        res.json({ message: "Product restored", product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



module.exports = {
    createProduct,
    getProducts,
    updateProduct,
    deleteProduct,
    restoreProduct
};
