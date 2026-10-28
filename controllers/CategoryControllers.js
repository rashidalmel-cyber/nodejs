const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

const CategoryModel = require('../models/CategoryModel');

// @desc    Get list of categories
// @route   GET /api/v1/categories
// @access  Public
exports.getCategories = asyncHandler(async (req, res, next) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(page) || page < 1
        || !Number.isSafeInteger(limit) || limit < 1
        || !Number.isSafeInteger(skip)) {
        return next(new ApiError('page and limit must be positive whole numbers within the supported range.', 400));
    }

    const categories = await CategoryModel.find({}).skip(skip).limit(limit);
    res.status(200).json({
        status: 'success',
        message: categories.length ? 'Categories retrieved successfully.' : 'No categories found.',
        results: categories.length,
        page,
        limit,
        data: categories,
    });
});


// @desc      Get specific category by id
// @route     GET /api/v1/categories/:id
// @access    Public
exports.getCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const category = await CategoryModel.findById(id);
  if (!category) {
    return next(new ApiError(`Category not found for ID: ${id}.`, 404));
  }
  res.status(200).json({ status: 'success', message: 'Category retrieved successfully.', data: category });
});


// @desc    Update specific category by id
// @route   PUT /api/v1/categories/:id
// @access  Private
exports.updateCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const name = req.body && req.body.name;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid category ID. Expected 24 hexadecimal characters.', 400));
  }

  if (typeof name !== 'string' || !name.trim()) {
    return next(new ApiError('Category name is required.', 400));
  }

  const category = await CategoryModel.findByIdAndUpdate(
    id,
    { name, slug: slugify(name) },
    { returnDocument: 'after', runValidators: true }
  );

  if (!category) {
    return next(new ApiError(`Category not found for ID: ${id}.`, 404));
  }

  return res.status(200).json({ status: 'success', message: 'Category updated successfully.', data: category });
});


// @desc    Delete specific category by id
// @route   DELETE /api/v1/categories/:id
// @access  Private
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid category ID. Expected 24 hexadecimal characters.', 400));
  }

  const category = await CategoryModel.findByIdAndDelete(id);

  if (!category) {
    return next(new ApiError(`Category not found for ID: ${id}.`, 404));
  }

  return res.status(200).json({ status: 'success', message: 'Category deleted successfully.', msg: 'Deleted successfully' });
});


// @desc    Create category
// @route   POST /api/v1/categories
// @access  Private
exports.createCategory = asyncHandler(async (req, res, next) => {
    const name = req.body && req.body.name;

    if (typeof name !== 'string' || !name.trim()) {
        return next(new ApiError('Category name is required.', 400));
    }

    const category = await CategoryModel.create({ name, slug: slugify(name) });
    res.status(201).json({ status: 'success', message: 'Category created successfully.', data: category });
});
