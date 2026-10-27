const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

const validatorMiddleware = (req, res, next) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const details = errors.array();
        const message = [...new Set(details.map((error) => error.msg))].join(' ');
        const error = new ApiError(message, 400);
        error.errors = details;
        return next(error);
    }
    next();
};

module.exports = validatorMiddleware;
