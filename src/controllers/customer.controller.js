const customerService = require("../services/customer.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const AppError = require("../utils/AppError");

const createCustomer = async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;

        if (!name || !email) {
            throw new AppError("Name and email are required", 400);
        }

        const customer = await customerService.createCustomer(req.user.business_id, { name, email, phone, address });
        return sendSuccess(res, 201, customer, "Customer created successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const getCustomers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const customers = await customerService.getAllCustomers(req.user.business_id, search);
        return sendSuccess(res, 200, { customers });
    } catch (error) {
        return sendError(res, error);
    }
};

const deleteCustomer = async (req, res) => {
    try {
        await customerService.deleteCustomer(req.params.id, req.user.business_id);
        return sendSuccess(res, 200, null, "Customer deleted successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const updateCustomer = async (req, res) => res.status(501).json({ message: "Not implemented" });
const restoreCustomer = async (req, res) => res.status(501).json({ message: "Not implemented" });

module.exports = { createCustomer, getCustomers, deleteCustomer, updateCustomer, restoreCustomer };
