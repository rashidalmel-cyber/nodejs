const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

const Brand = require('../models/BrandModel');

// @desc    Get list of brands
// @route   GET /api/v1/brands
// @access  Public
exports.getBrands = asyncHandler(async (req, res, next) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(page) || page < 1
        || !Number.isSafeInteger(limit) || limit < 1
        || !Number.isSafeInteger(skip)) {
        return next(new ApiError('page and limit must be positive whole numbers within the supported range.', 400));
    }

    const brands = await Brand.find({}).skip(skip).limit(limit);
    res.status(200).json({
        status: 'success',
        message: brands.length ? 'Brands retrieved successfully.' : 'No brands found.',
        results: brands.length,
        page,
        limit,
        data: brands,
    });
});


// @desc      Get specific brand by id
// @route     GET /api/v1/brands/:id
// @access    Public
exports.getBrand = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid brand ID. Expected 24 hexadecimal characters.', 400));
  }

  const brand = await Brand.findById(id);
  if (!brand) {
    return next(new ApiError(`Brand not found for ID: ${id}.`, 404));
  }
  res.status(200).json({ status: 'success', message: 'Brand retrieved successfully.', data: brand });
});


// @desc    Update specific brand by id
// @route   PUT /api/v1/brands/:id
// @access  Private
exports.updateBrand = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const name = req.body && req.body.name;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid brand ID. Expected 24 hexadecimal characters.', 400));
  }

  if (typeof name !== 'string' || !name.trim()) {
    return next(new ApiError('Brand name is required.', 400));
  }

  const brand = await Brand.findByIdAndUpdate(
    id,
    { name, slug: slugify(name) },
    { returnDocument: 'after', runValidators: true }
  );

  if (!brand) {
    return next(new ApiError(`Brand not found for ID: ${id}.`, 404));
  }

  return res.status(200).json({ status: 'success', message: 'Brand updated successfully.', data: brand });
});


// @desc    Delete specific brand by id
// @route   DELETE /api/v1/brands/:id
// @access  Private
exports.deleteBrand = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(new ApiError('Invalid brand ID. Expected 24 hexadecimal characters.', 400));
  }

  const brand = await Brand.findByIdAndDelete(id);

  if (!brand) {
    return next(new ApiError(`Brand not found for ID: ${id}.`, 404));
  }

  return res.status(200).json({ status: 'success', message: 'Brand deleted successfully.', msg: 'Deleted successfully' });
});


// @desc    Create brand
// @route   POST /api/v1/brands
// @access  Private
exports.createBrand = asyncHandler(async (req, res, next) => {
    const name = req.body && req.body.name;

    if (typeof name !== 'string' || !name.trim()) {
        return next(new ApiError('Brand name is required.', 400));
    }

    const brand = await Brand.create({ name, slug: slugify(name) });
    res.status(201).json({ status: 'success', message: 'Brand created successfully.', data: brand });
});
