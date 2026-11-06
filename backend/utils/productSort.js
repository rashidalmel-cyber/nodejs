const ApiError = require('./apiError');

const sortableFields = new Set([
  'title', 'slug', 'price', 'priceAfterDiscount', 'quantity', 'sold',
  'ratingsAverage', 'ratingsQuantity', 'createdAt', 'updatedAt', '_id',
]);

const invalidSort = (value, message) => {
  const error = new ApiError(message, 400);
  error.errors = [{ type: 'field', path: 'sort', value, msg: message, location: 'query' }];
  return error;
};

const getProductSort = (value) => {
  if (value === undefined || (typeof value === 'string' && !value.trim())) {
    return { createdAt: -1, _id: -1 };
  }
  if (typeof value !== 'string') {
    throw invalidSort(value, 'sort must be a single string.');
  }

  const sort = {};
  value.split(',').forEach((part) => {
    const token = part.trim();
    const descending = token.startsWith('-');
    const field = descending ? token.slice(1) : token;
    if (!sortableFields.has(field)) {
      throw invalidSort(value,
        `sort must contain supported fields separated by commas: ${[...sortableFields].join(', ')}. Prefix a field with - for descending order.`);
    }
    if (Object.prototype.hasOwnProperty.call(sort, field)) {
      throw invalidSort(value, 'sort must not contain duplicate fields.');
    }
    sort[field] = descending ? -1 : 1;
  });

  // A unique final key keeps equal values in a consistent order across pages.
  if (!Object.prototype.hasOwnProperty.call(sort, '_id')) sort._id = 1;
  return sort;
};

module.exports = getProductSort;
