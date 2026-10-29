const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

const Product = require('../models/productmodel');

const productFields = [
  'title', 'description', 'quantity', 'price', 'priceAfterDiscount',
  'colors', 'imageCover', 'images', 'category', 'subcategory', 'brand',
];

const getProductData = (body) => {
  const data = {};
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    productFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field];
    });
  }
  return data;
};

// @desc    Get list of products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res, next) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(page) || page < 1
        || !Number.isSafeInteger(limit) || limit < 1
        || !Number.isSafeInteger(skip)) {
        return next(new ApiError('page and limit must be positive whole numbers within the supported range.', 400));
    }

    const products = await Product.find({}).skip(skip).limit(limit);
    res.status(200).json({
        status: 'success',
        message: products.length ? 'Products retrieved successfully.' : 'No products found.',
        results: products.length,
        page,
        limit,
        data: products,
    });
});


// @desc      Get specific product by id
// @route     GET /api/v1/products/:id
// @access    Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid product ID. Expected 24 hexadecimal characters.', 400));
  }

  const product = await Product.findById(id);
  if (!product) {
    return next(new ApiError(`Product not found for ID: ${id}.`, 404));
  }
  res.status(200).json({ status: 'success', message: 'Product retrieved successfully.', data: product });
});


// @desc    Update specific product by id
// @route   PUT /api/v1/products/:id
// @access  Private
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid product ID. Expected 24 hexadecimal characters.', 400));
  }

  const data = getProductData(req.body);
  if (!Object.keys(data).length) {
    return next(new ApiError('At least one product field is required.', 400));
  }

  if (Object.prototype.hasOwnProperty.call(data, 'title')) {
    if (typeof data.title !== 'string' || !data.title.trim()) {
      return next(new ApiError('Product title is required.', 400));
    }
    data.title = data.title.trim();
    data.slug = slugify(data.title);
  }

  const product = await Product.findByIdAndUpdate(
    id,
    data,
    { returnDocument: 'after', runValidators: true }
  );

  if (!product) {
    return next(new ApiError(`Product not found for ID: ${id}.`, 404));
  }

  return res.status(200).json({ status: 'success', message: 'Product updated successfully.', data: product });
});


// @desc    Delete specific product by id
// @route   DELETE /api/v1/products/:id
// @access  Private
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid product ID. Expected 24 hexadecimal characters.', 400));
  }

  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    return next(new ApiError(`Product not found for ID: ${id}.`, 404));
  }

  return res.status(200).json({ status: 'success', message: 'Product deleted successfully.', msg: 'Deleted successfully' });
});


// @desc    Create product
// @route   POST /api/v1/products
// @access  Private
exports.createProduct = asyncHandler(async (req, res, next) => {
    const data = getProductData(req.body);

    if (typeof data.title !== 'string' || !data.title.trim()) {
        return next(new ApiError('Product title is required.', 400));
    }

    data.title = data.title.trim();
    data.slug = slugify(data.title);
    const product = await Product.create(data);
    res.status(201).json({ status: 'success', message: 'Product created successfully.', data: product });
});
