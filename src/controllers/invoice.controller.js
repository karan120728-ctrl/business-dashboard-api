const invoiceService = require("../services/invoice.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");

const getInvoices = async (req, res) => {
    try {
        const invoices = await invoiceService.getInvoices(req.user.business_id);
        return sendSuccess(res, 200, { invoices }, "Invoices retrieved successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const stats = await invoiceService.getDashboardStats(req.user.business_id);
        return sendSuccess(res, 200, { stats }, "Dashboard stats retrieved");
    } catch (error) {
        return sendError(res, error);
    }
};

const getInvoiceByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const invoice = await invoiceService.getInvoiceByToken(token);
        return sendSuccess(res, 200, { invoice }, "Invoice retrieved");
    } catch (error) {
        return sendError(res, error);
    }
};

const simulatePayment = async (req, res) => {
    try {
        const { token } = req.params;
        const result = await invoiceService.simulatePayment(token);
        return sendSuccess(res, 200, result, "Payment successful");
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = {
    getInvoices,
    getDashboardStats,
    getInvoiceByToken,
    simulatePayment
};
