const ApiError = require('./apiError');

const message = 'page and limit must be positive whole numbers within the supported range.';

const paginationError = (field, value) => {
  const error = new ApiError(message, 400);
  error.errors = [{ type: 'field', path: field, value, msg: message, location: 'query' }];
  return error;
};

const getPagination = (query, defaultLimit = 25) => {
  const pagination = { page: 1, limit: defaultLimit };

  Object.keys(pagination).forEach((field) => {
    const value = query[field];
    if (value === undefined) return;
    const number = Number(value);
    if (typeof value !== 'string' || !/^\d+$/.test(value)
      || !Number.isSafeInteger(number) || number < 1) {
      throw paginationError(field, value);
    }
    pagination[field] = number;
  });

  const skip = (pagination.page - 1) * pagination.limit;
  if (!Number.isSafeInteger(skip)) {
    throw paginationError('page', query.page);
  }

  return { ...pagination, skip };
};

module.exports = getPagination;
