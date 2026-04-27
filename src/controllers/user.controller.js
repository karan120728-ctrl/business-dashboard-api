const userService = require("../services/user.service");
const { sendSuccess, sendError } = require("../utils/responseHandler");
const AppError = require("../utils/AppError");

const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // Lightweight controller validation
        if (!name || !email || !password) {
            throw new AppError("Name, email, and password are required", 400);
        }

        const newUser = await userService.createUser({ name, email, password, role });
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
        const users = await userService.getAllUsers();
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

        const token = await userService.forgotPassword(email);
        
        // In Dev Mode, we return the token in the response.
        // In Production, this would be sent via email.
        return sendSuccess(res, 200, { resetToken: token }, "Reset token generated successfully (Dev Mode)");
    } catch (error) {
        return sendError(res, error);
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) throw new AppError("Token and new password are required", 400);

        await userService.resetPassword(token, newPassword);
        return sendSuccess(res, 200, null, "Password reset successfully");
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = { createUser, getUser, loginUser, updateUser, forgotPassword, resetPassword };
