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
  .custom((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    && (!integer || Number.isSafeInteger(value)))
  .withMessage(integer
    ? `${label} must be a nonnegative whole number within the supported range.`
    : `${label} must be a nonnegative finite number.`);

const objectIdValidator = (field) => body(field)
  .isString().withMessage(`${field} must be a string.`).bail()
  .isMongoId().withMessage(`Invalid ${field}. Expected 24 hexadecimal characters.`);

const referenceArrayValidators = (field) => [
  body(field).optional()
    .isArray().withMessage(`${field} must be an array of IDs.`).bail()
    .custom((values) => new Set(values.map((value) => String(value).toLowerCase())).size === values.length)
    .withMessage(`${field} must not contain duplicate IDs.`),
  objectIdValidator(`${field}.*`),
];

const stringArrayValidators = (field) => [
  body(field).optional().isArray().withMessage(`${field} must be an array of strings.`),
  body(`${field}.*`)
    .isString().withMessage(`Each ${field} item must be a string.`).bail()
    .trim().notEmpty().withMessage(`Each ${field} item must not be empty.`),
];

const productBodyValidators = (update = false) => {
  const required = [
    stringValidator('title', 'Product title', 3, 100),
    stringValidator('description', 'Product description', 20),
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
    ...referenceArrayValidators('subcategory'),
    ...referenceArrayValidators('brand'),
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
  if (req.params.id && ['category', 'subcategory', 'price', 'priceAfterDiscount']
    .some((field) => data[field] !== undefined)) {
    current = await Product.findById(req.params.id).select('category subcategory price priceAfterDiscount');
    if (!current) return next(new ApiError(`Product not found for ID: ${req.params.id}.`, 404));
  }

  const price = data.price === undefined && current ? current.price : data.price;
  const discount = data.priceAfterDiscount === undefined && current
    ? current.priceAfterDiscount : data.priceAfterDiscount;
  if (discount !== undefined && discount !== null && discount > price) {
    return next(invalidField('priceAfterDiscount', 'Discounted product price cannot exceed the product price.'));
  }

  if (data.category !== undefined || data.subcategory !== undefined) {
    const categoryId = data.category === undefined && current ? current.category : data.category;
    const category = await Category.findById(categoryId).select('_id');
    if (!category) return next(invalidField('category', `Category not found for ID: ${categoryId}.`));

    let subcategoryIds = data.subcategory;
    if (subcategoryIds === undefined) subcategoryIds = current ? current.subcategory : [];
    if (subcategoryIds.length) {
      const subcategories = await SubCategory.find({ _id: { $in: subcategoryIds } }).select('_id category');
      if (subcategories.length !== subcategoryIds.length) {
        return next(invalidField('subcategory', 'One or more subcategories do not exist.'));
      }
      if (subcategories.some((subcategory) => String(subcategory.category) !== String(category._id))) {
        return next(invalidField('subcategory', 'Every subcategory must belong to the selected category.'));
      }
    }
  }

  if (data.brand && data.brand.length) {
    const brands = await Brand.find({ _id: { $in: data.brand } }).select('_id');
    if (brands.length !== data.brand.length) {
      return next(invalidField('brand', 'One or more brands do not exist.'));
    }
  }
  return next();
});

exports.getProductsValidator = [
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
