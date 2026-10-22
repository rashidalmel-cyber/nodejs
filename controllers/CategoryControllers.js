const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const CategoryModel = require('../models/CategoryModel');

// @desc    Get list of categories
// @route   GET /api/v1/categories
// @access  Public
exports.getCategories = asyncHandler(async (req, res) => {
    const page =  req.query.page *1  || 1;
    const limit = req.query.limit *1  || 5;
    const skip = (page - 1) * limit;
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
    res.status(404).json({ msg: `No category for this id ${id}` });
  }
  res.status(200).json({ data: category });
});


// @desc    Update specific category by id
// @route   PUT /api/v1/categories/:id
// @access  Private
exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const name = req.body?.name;

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


// @desc    Create category
// @route   POST /api/v1/categories
// @access  Private
exports.createCategory = asyncHandler(async (req, res) => {
    const name = req.body.name;
    const category = await CategoryModel.create({ name, slug: slugify(name) });
    res.status(201).json({ data: category });
});
