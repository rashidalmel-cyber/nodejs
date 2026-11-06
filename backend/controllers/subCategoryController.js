const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const CategoryModel = require('../models/CategoryModel');
const getPagination = require('../utils/pagination');

const SubCategory = require('../models/SubCategoryModel');

const ensureParentCategoryExists = async (categoryId) => {
  const category = await CategoryModel.findById(categoryId);
  if (!category) throw new ApiError(`Parent category not found for ID: ${categoryId}.`, 404);
};

// Nested creates get their parent category from the URL before body validation.
exports.setCategoryIdToBody = (req, res, next) => {
  if (req.params.categoryId) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
      req.body = {};
    if (
      req.body.category !== undefined &&
      String(req.body.category).toLowerCase() !==
        req.params.categoryId.toLowerCase()
    ) {
      return next(
        new ApiError('category must match the category ID in the URL.', 400)
      );
    }
    req.body.category = req.params.categoryId;
  }
  return next();
};

// @desc    Get list of subCategories
// @route   GET /api/v1/subcategories
// @route   GET /api/v1/categories/:categoryId/subcategories
// @access  Public
exports.getSubCategories = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  const { categoryId } = req.params;
  if (categoryId) {
    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      return next(
        new ApiError(`Category not found for ID: ${categoryId}.`, 404)
      );
    }
    filter.category = categoryId;
  }

  const subCategories = await SubCategory.find(filter)
    .skip(skip)
    .limit(limit)
    .populate('category');
  return res.status(200).json({
    results: subCategories.length,
    page,
    data: subCategories
  });
});

// @desc    Get specific subCategory by id
// @route   GET /api/v1/subcategories/:id
// @access  Public
exports.getSubCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const subCategory = await SubCategory.findById(id).populate(
    'category',
    'name'
  );

  if (!subCategory) {
    return next(new ApiError(`Subcategory not found for ID: ${id}.`, 404));
  }

  return res
    .status(200)
    .json({
      status: 'success',
      message: 'Subcategory retrieved successfully.',
      data: subCategory
    });
});

// @desc    Create subCategory
// @route   POST /api/v1/subcategories
// @route   POST /api/v1/categories/:categoryId/subcategories
// @access  Private
exports.createSubCategory = asyncHandler(async (req, res) => {
  const { name, category: categoryId } = req.body;

  await ensureParentCategoryExists(categoryId);

  const subCategory = await SubCategory.create({
    name,
    slug: slugify(name),
    category: categoryId
  });

  await subCategory.populate('category', 'name');

  res
    .status(201)
    .json({
      status: 'success',
      message: 'Subcategory created successfully.',
      data: subCategory
    });
});

// @desc    Update specific subCategory
// @route   PUT /api/v1/subcategories/:id
// @access  Private
exports.updateSubCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name, category: categoryId } = req.body;
  const update = { name, slug: slugify(name) };

  if (categoryId !== undefined) {
    await ensureParentCategoryExists(categoryId);
    update.category = categoryId;
  }

  const subCategory = await SubCategory.findByIdAndUpdate(id, update, {
    returnDocument: 'after',
    runValidators: true
  }).populate('category', 'name');

  if (!subCategory) {
    return next(new ApiError(`Subcategory not found for ID: ${id}.`, 404));
  }

  return res
    .status(200)
    .json({
      status: 'success',
      message: 'Subcategory updated successfully.',
      data: subCategory
    });
});

// @desc    Delete specific subCategory
// @route   DELETE /api/v1/subcategories/:id
// @access  Private
exports.deleteSubCategory = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const subCategory = await SubCategory.findByIdAndDelete(id);

  if (!subCategory) {
    return next(new ApiError(`Subcategory not found for ID: ${id}.`, 404));
  }

  return res
    .status(200)
    .json({
      status: 'success',
      message: 'Subcategory deleted successfully.',
      msg: 'Deleted successfully'
    });
});
