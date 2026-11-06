const globalError = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const duplicateError = [err, err.cause]
        .find((error) => error && (error.code === 11000 || error.code === 11001));
    const errorStatus = err.statusCode || err.status;
    let statusCode = Number.isInteger(errorStatus) && errorStatus >= 400 && errorStatus <= 599
        ? errorStatus
        : 500;
    let message = err.message || 'An unexpected server error occurred. Please try again.';
    let details = Array.isArray(err.errors) ? err.errors : undefined;

    if (duplicateError) {
        statusCode = 409;
        const fields = Object.keys(duplicateError.keyPattern || duplicateError.keyValue || { name: 1 });
        message = `A record with this ${fields.join(', ')} already exists. Use a different value.`;
    } else if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'Invalid JSON body. Check commas, double quotes, and brackets.';
    } else if (err.type === 'entity.too.large') {
        statusCode = 413;
        message = 'Request body is too large. Send a smaller JSON body.';
    } else if (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
        statusCode = 415;
        message = 'Unsupported request encoding. Send the body as UTF-8 JSON.';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid value for ${err.path === '_id' ? 'id' : err.path}. Check the value and try again.`;
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        details = Object.values(err.errors).map((error) => ({ path: error.path, msg: error.message }));
        message = details.map((error) => error.msg).join(' ');
    } else if (['MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError',
        'MongoNetworkTimeoutError', 'MongoNotConnectedError', 'MongoTopologyClosedError'].includes(err.name)) {
        statusCode = 503;
        message = 'Database is unavailable. Please try again later.';
    } else if (err.code === 50) {
        statusCode = 503;
        message = 'Database request timed out. Please try again later.';
    } else if (statusCode >= 500 && !err.isOperational) {
        message = 'An unexpected server error occurred. Please try again.';
    }

    const response = {
        status: statusCode < 500 ? 'fail' : 'error',
        statusCode,
        message,
        path: req.originalUrl,
        method: req.method,
    };

    if (details) {
        response.errors = details;
    }

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    return res.status(statusCode).json(response);
};

module.exports = globalError;
