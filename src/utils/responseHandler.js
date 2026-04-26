const sendSuccess = (res, statusCode, data, message = null) => {
    const response = {};
    if (message) response.message = message;
    if (data) {
        // If data is an array or object, we merge it or assign it to a key
        // To keep backward compatibility with existing API responses, we can just return it or spread it
        if (typeof data === 'object' && !Array.isArray(data)) {
            Object.assign(response, data);
        } else {
            return res.status(statusCode).json(data);
        }
    }
    return res.status(statusCode).json(response);
};

const sendError = (res, err) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    
    // In production, we don't leak stack traces
    console.error(`[Error] ${statusCode} - ${message}`);
    
    return res.status(statusCode).json({ message });
};

module.exports = {
    sendSuccess,
    sendError
};
