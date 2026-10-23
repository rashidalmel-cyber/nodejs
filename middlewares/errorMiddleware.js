const globalError = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const errorStatus = err.statusCode || err.status;
    const statusCode = Number.isInteger(errorStatus) && errorStatus >= 400 && errorStatus <= 599
        ? errorStatus
        : 500;

    const response = {
        status: statusCode < 500 ? 'fail' : 'error',
        statusCode,
        message: err.message || 'Internal server error',
        path: req.originalUrl,
        method: req.method,
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    return res.status(statusCode).json(response);
};

module.exports = globalError;
