const productService = require("../services/product.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const AppError = require("../utils/AppError");

const createProduct = async (req, res) => {
    try {
        const { name, price, description } = req.body;

        if (!name || price === undefined) {
            throw new AppError("Name and price are required", 400);
        }

        const product = await productService.createProduct(req.user.business_id, { name, price, description });
        return sendSuccess(res, 201, { product }, "Product created successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const getProducts = async (req, res) => {
    try {
        const search = req.query.search || '';
        const products = await productService.getAllProducts(req.user.business_id, search);
        return sendSuccess(res, 200, { products });
    } catch (error) {
        return sendError(res, error);
    }
};

const deleteProduct = async (req, res) => {
    try {
        await productService.deleteProduct(req.params.id, req.user.business_id);
        return sendSuccess(res, 200, null, "Product deleted successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const updateProduct = async (req, res) => res.status(501).json({ message: "Not implemented" });
const restoreProduct = async (req, res) => res.status(501).json({ message: "Not implemented" });

module.exports = { createProduct, getProducts, deleteProduct, updateProduct, restoreProduct };
