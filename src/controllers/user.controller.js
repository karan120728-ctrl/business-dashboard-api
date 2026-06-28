const userService = require("../services/user.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const AppError = require("../utils/AppError");

const createUser = async (req, res) => {
    try {
        const { name, email, password, role, businessName, businessCode, phone } = req.body;
        
        if (!name || !email || !password) {
            throw new AppError("Name, email, and password are required", 400);
        }

        const newUser = await userService.createUser({ name, email, password, role, businessName, businessCode, phone });
        return sendSuccess(res, 201, newUser, "User created successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Lightweight controller validation
        if (!email || !password) {
            throw new AppError("Email and password are required", 400);
        }

        const loginData = await userService.loginUser(email, password);
        return sendSuccess(res, 200, loginData, "Login successful");
    } catch (error) {
        return sendError(res, error);
    }
};

const getUser = async (req, res) => {
    try {
        if (!req.user || !req.user.business_id) {
            return sendError(res, new Error("Unauthorized: Business ID missing"), 401);
        }
        const users = await userService.getAllUsers(req.user.business_id);
        return sendSuccess(res, 200, users);
    } catch (error) {
        return sendError(res, error);
    }
};

const updateUser = async (req, res) => {
    try {
        const { role, is_active } = req.body;
        await userService.updateUser(req.params.id, { role, is_active });
        return sendSuccess(res, 200, null, "User updated successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) throw new AppError("Email is required", 400);

        await userService.forgotPassword(email);
        return sendSuccess(res, 200, null, "OTP sent to your email address");
    } catch (error) {
        return sendError(res, error);
    }
};

const resetPassword = async (req, res) => {
    try {
        const { otp, email, newPassword } = req.body;
        if (!otp || !email || !newPassword) throw new AppError("OTP, email and new password are required", 400);

        await userService.resetPassword(otp, email, newPassword);
        return sendSuccess(res, 200, null, "Password reset successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const updatePushToken = async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) throw new AppError("Push token is required", 400);

        await userService.updatePushToken(req.user.id, pushToken);
        return sendSuccess(res, 200, null, "Push token registered successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const savePushSubscription = async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint) {
            throw new AppError("Valid push subscription is required", 400);
        }
        await userService.savePushSubscription(req.user.id, subscription);
        return sendSuccess(res, 200, null, "Push subscription saved successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const regenerateCode = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            throw new AppError("Unauthorized", 403);
        }
        const newCode = await userService.regenerateBusinessCode(req.user.business_id);
        return sendSuccess(res, 200, { newCode }, "Business code regenerated successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

const deleteUser = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            throw new AppError("Unauthorized", 403);
        }
        await userService.deleteUser(req.params.id, req.user.business_id);
        return sendSuccess(res, 200, null, "User deleted successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = { createUser, getUser, loginUser, updateUser, forgotPassword, resetPassword, updatePushToken, regenerateCode, deleteUser, savePushSubscription };
