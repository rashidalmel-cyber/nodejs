const { body, param, query } = require('express-validator');
const asyncHandler = require('express-async-handler');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');
const ApiError = require('../apiError');
const Product = require('../../models/productmodel');
const Category = require('../../models/CategoryModel');
const SubCategory = require('../../models/SubCategoryModel');
const Brand = require('../../models/BrandModel');

const productIdValidator = () => param('id')
  .isMongoId()
  .withMessage('Invalid product ID. Expected 24 hexadecimal characters.');

const stringValidator = (field, label, min, max) => body(field)
  .exists().withMessage(`${label} is required.`).bail()
  .isString().withMessage(`${label} must be a string.`).bail()
  .trim()
  .isLength({ min, ...(max ? { max } : {}) })
  .withMessage(max
    ? `${label} must contain between ${min} and ${max} characters.`
    : `${label} must contain at least ${min} character${min === 1 ? '' : 's'}.`);

const numberValidator = (field, label, integer = false) => body(field)
  .exists().withMessage(`${label} is required.`).bail()
  .custom((value) => typeof value === 'number' || typeof value === 'string')
  .withMessage(`${label} must be a number.`).bail()
  .isFloat({ min: 0 }).withMessage(`${label} must be a nonnegative finite number.`).bail()
  .custom((value) => !integer || Number.isSafeInteger(Number(value)))
  .withMessage(integer
    ? `${label} must be a nonnegative whole number within the supported range.`
    : `${label} must be a nonnegative finite number.`)
  .bail().toFloat();

const objectIdValidator = (field) => body(field)
  .isString().withMessage(`${field} must be a string.`).bail()
  .isMongoId().withMessage(`Invalid ${field}. Expected 24 hexadecimal characters.`);

const referenceArrayValidators = (field) => {
  const arrayValidator = body(field)
    .optional()
    .isArray({ min: 1 }).withMessage(`${field} must be an array containing at least one ID.`).bail()
    .custom((values) => new Set(values.map((value) => String(value).toLowerCase())).size === values.length)
    .withMessage(`${field} must not contain duplicate IDs.`);
  return [
    arrayValidator,
    objectIdValidator(`${field}.*`),
  ];
};

const stringArrayValidators = (field) => [
  body(field).optional().isArray().withMessage(`${field} must be an array of strings.`),
  body(`${field}.*`)
    .isString().withMessage(`Each ${field} item must be a string.`).bail()
    .trim().notEmpty().withMessage(`Each ${field} item must not be empty.`),
];

const productBodyValidators = (update = false) => {
  const required = [
    stringValidator('title', 'Product title', 3, 100),
    stringValidator('description', 'Product description', 20, 2000),
    numberValidator('quantity', 'Product quantity', true),
    numberValidator('price', 'Product price'),
    stringValidator('imageCover', 'Product image cover', 1),
    objectIdValidator('category'),
  ];
  return [
    ...required.map((validator) => (update ? validator.optional() : validator)),
    numberValidator('priceAfterDiscount', 'Discounted product price').optional(),
    ...stringArrayValidators('colors'),
    ...stringArrayValidators('images'),
    ...referenceArrayValidators('subcategories'),
    objectIdValidator('brand').optional(),
    numberValidator('sold', 'Sold quantity', true).optional(),
    numberValidator('ratingsAverage', 'Average rating').optional()
      .custom((value) => value >= 1 && value <= 5)
      .withMessage('Average rating must be between 1 and 5.'),
    numberValidator('ratingsQuantity', 'Ratings quantity', true).optional(),
    body('subcategory').not().exists()
      .withMessage('Use subcategories (plural) instead of subcategory.'),
  ];
};

const jsonBodyValidator = () => body()
  .custom((value) => value !== null && typeof value === 'object' && !Array.isArray(value))
  .withMessage('Product body must be a JSON object.');

const invalidField = (path, message) => {
  const error = new ApiError(message, 400);
  error.errors = [{ type: 'field', path, msg: message, location: 'body' }];
  return error;
};

// Check references after syntax validation so database failures reach the error middleware.
const validateProductData = asyncHandler(async (req, res, next) => {
  const data = req.body;
  let current;
  if (req.params.id && ['category', 'subcategories', 'price', 'priceAfterDiscount']
    .some((field) => data[field] !== undefined)) {
    current = await Product.findById(req.params.id).select('category subcategories price priceAfterDiscount');
    if (!current) return next(new ApiError(`Product not found for ID: ${req.params.id}.`, 404));
  }

  const price = data.price === undefined && current ? current.price : data.price;
  const discount = data.priceAfterDiscount === undefined && current
    ? current.priceAfterDiscount : data.priceAfterDiscount;
  if (discount !== undefined && discount !== null && discount >= price) {
    return next(invalidField('priceAfterDiscount', 'Discounted product price must be lower than the product price.'));
  }

  if (data.category !== undefined || data.subcategories !== undefined) {
    const categoryId = data.category === undefined && current ? current.category : data.category;
    const category = await Category.findById(categoryId).select('_id');
    if (!category) return next(invalidField('category', `Category not found for ID: ${categoryId}.`));

    let subcategoryIds = data.subcategories;
    if (subcategoryIds === undefined) subcategoryIds = current ? current.subcategories : [];
    if (subcategoryIds.length) {
      const subcategories = await SubCategory.find({ _id: { $in: subcategoryIds } }).select('_id category');
      if (subcategories.length !== subcategoryIds.length) {
        return next(invalidField('subcategories', 'One or more subcategories do not exist.'));
      }
      if (subcategories.some((subcategory) => String(subcategory.category) !== String(category._id))) {
        return next(invalidField('subcategories', 'Every subcategory must belong to the selected category.'));
      }
    }
  }

  if (data.brand !== undefined) {
    const brand = await Brand.findById(data.brand).select('_id');
    if (!brand) return next(invalidField('brand', `Brand not found for ID: ${data.brand}.`));
  }
  return next();
});

exports.getProductsValidator = [
  query('keyword').optional()
    .isString().withMessage('keyword must be a single string.').bail()
    .trim()
    .isLength({ max: 200 }).withMessage('keyword must contain at most 200 characters.'),
  ...['page', 'limit'].map((field) => query(field).optional()
    .custom((value) => typeof value === 'string' && /^\d+$/.test(value)
      && Number.isSafeInteger(Number(value)) && Number(value) > 0)
    .withMessage('page and limit must be positive whole numbers within the supported range.')),
  validatorMiddleware,
];

exports.getProductValidator = [productIdValidator(), validatorMiddleware];

exports.createProductValidator = [
  jsonBodyValidator(),
  ...productBodyValidators(),
  validatorMiddleware,
  validateProductData,
];

exports.updateProductValidator = [
  productIdValidator(),
  jsonBodyValidator(),
  ...productBodyValidators(true),
  validatorMiddleware,
  validateProductData,
];

exports.deleteProductValidator = [productIdValidator(), validatorMiddleware];
