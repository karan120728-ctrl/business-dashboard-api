const batchService = require("../services/batch.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");

const createBatch = async (req, res) => {
    try {
        const result = await batchService.createBatch(req.user.business_id, req.user.id, req.body, req.app.get('io'));
        return sendSuccess(res, 201, result, "Batch route assigned successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const getDriverBatches = async (req, res) => {
    try {
        // Driver getting their own batches
        const batches = await batchService.getDriverBatches(req.user.id, req.user.business_id);
        return sendSuccess(res, 200, { batches });
    } catch (error) {
        return sendError(res, error);
    }
};

const getBatchDetails = async (req, res) => {
    try {
        const orders = await batchService.getBatchDetails(req.params.id, req.user.business_id);
        return sendSuccess(res, 200, { orders });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = {
    createBatch,
    getDriverBatches,
    getBatchDetails
};
