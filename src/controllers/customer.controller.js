const customerService = require("../services/customer.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const AppError = require("../utils/AppError");

const createCustomer = async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;

        // Lightweight controller validation
        if (!name || !email || !phone) {
            throw new AppError("Name, email and phone are required", 400);
        }

        const customer = await customerService.createCustomer({ name, email, phone, address });
        return sendSuccess(res, 201, customer, "Customer created successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const getCustomers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const customers = await customerService.getAllCustomers(search);
        // Note: the frontend expects { customers: [...] } based on existing code, so we wrap it
        return sendSuccess(res, 200, { customers });
    } catch (error) {
        return sendError(res, error);
    }
};

const deleteCustomer = async (req, res) => {
    try {
        await customerService.deleteCustomer(req.params.id);
        return sendSuccess(res, 200, null, "Customer deleted successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const updateCustomer = async (req, res) => res.status(501).json({ message: "Not implemented" });
const restoreCustomer = async (req, res) => res.status(501).json({ message: "Not implemented" });

module.exports = { createCustomer, getCustomers, deleteCustomer, updateCustomer, restoreCustomer };
