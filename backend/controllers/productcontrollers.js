const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const getPagination = require('../utils/pagination');
const getProductSort = require('../utils/productSort');
const escapeRegex = require('../utils/escapeRegex');

const Product = require('../models/productmodel');

const productReferences = [
  { path: 'category', select: '_id name' },
  { path: 'subcategories', select: '_id name' },
  { path: 'brand', select: '_id name' }
];

const productFields = [
  'title',
  'description',
  'quantity',
  'price',
  'priceAfterDiscount',
  'colors',
  'imageCover',
  'images',
  'category',
  'subcategories',
  'brand',
  'sold',
  'ratingsAverage',
  'ratingsQuantity'
];

const getProductData = (body) => {
  const data = {};
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    productFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field))
        data[field] = body[field];
    });
  }
  return data;
};

// @desc    Get list of products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getProductSort(req.query.sort);

  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  const searchKeyword = req.query.keyword ? req.query.keyword.trim() : '';
  if (searchKeyword) {
    const keyword = escapeRegex(searchKeyword);
    filter.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } }
    ];
  }

  const products = await Product.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(productReferences);
  res.status(200).json({
    status: 'success',
    message: products.length
      ? 'Products retrieved successfully.'
      : 'No products found.',
    results: products.length,
    page,
    limit,
    data: products
  });
});

// @desc      Get specific product by id
// @route     GET /api/v1/products/:id
// @access    Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const product = await Product.findById(id).populate(productReferences);
  if (!product) {
    return next(new ApiError(`Product not found for ID: ${id}.`, 404));
  }
  res
    .status(200)
    .json({
      status: 'success',
      message: 'Product retrieved successfully.',
      data: product
    });
});

// @desc    Update specific product by id
// @route   PUT /api/v1/products/:id
// @access  Private
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

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

  const product = await Product.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true
  }).populate(productReferences);

  if (!product) {
    return next(new ApiError(`Product not found for ID: ${id}.`, 404));
  }

  return res
    .status(200)
    .json({
      status: 'success',
      message: 'Product updated successfully.',
      data: product
    });
});

// @desc    Delete specific product by id
// @route   DELETE /api/v1/products/:id
// @access  Private
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const product = await Product.findByIdAndDelete(id);

  if (!product) {
    return next(new ApiError(`Product not found for ID: ${id}.`, 404));
  }

  return res
    .status(200)
    .json({
      status: 'success',
      message: 'Product deleted successfully.',
      msg: 'Deleted successfully'
    });
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
  await product.populate(productReferences);
  res
    .status(201)
    .json({
      status: 'success',
      message: 'Product created successfully.',
      data: product
    });
});
