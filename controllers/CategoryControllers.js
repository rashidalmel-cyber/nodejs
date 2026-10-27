const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const CategoryModel = require('../models/CategoryModel');

// @desc    Get list of categories
// @route   GET /api/v1/categories
// @access  Public
exports.getCategories = asyncHandler(async (req, res) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(page) || page < 1
        || !Number.isSafeInteger(limit) || limit < 1
        || !Number.isSafeInteger(skip)) {
        return res.status(400).json({ msg: 'page and limit must be positive integers within the supported range' });
    }

    const categories = await CategoryModel.find({}).skip(skip).limit(limit);
    res.status(200).json({ results: categories.length, page, data: categories });
});


// @desc      Get specific category by id
// @route     GET /api/v1/categories/:id
// @access    Public
exports.getCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await CategoryModel.findById(id);
  if (!category) {
    return res.status(404).json({ msg: `No category for this id ${id}` });
  }
  res.status(200).json({ data: category });
});


// @desc    Update specific category by id
// @route   PUT /api/v1/categories/:id
// @access  Private
exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const name = req.body && req.body.name;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ msg: 'Invalid category id' });
  }

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ msg: 'Category name is required' });
  }

  try {
    const category = await CategoryModel.findByIdAndUpdate(
      id,
      { name, slug: slugify(name) },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ msg: `No category for this id ${id}` });
    }

    return res.status(200).json({ data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ msg: 'Category name must be unique' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ msg: err.message });
    }
    throw err;
  }
});


// @desc    Delete specific category by id
// @route   DELETE /api/v1/categories/:id
// @access  Private
exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ msg: 'Invalid category id' });
  }

  const category = await CategoryModel.findByIdAndDelete(id);

  if (!category) {
    return res.status(404).json({ msg: `No category for this id ${id}` });
  }

  return res.status(200).json({ msg: 'Deleted successfully' });
});


// @desc    Create category
// @route   POST /api/v1/categories
// @access  Private
exports.createCategory = asyncHandler(async (req, res) => {
    const name = req.body && req.body.name;

    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ msg: 'Category name is required' });
    }

    const category = await CategoryModel.create({ name, slug: slugify(name) });
    res.status(201).json({ data: category });
});
