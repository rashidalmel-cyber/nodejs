const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const CategoryModel = require('../models/CategoryModel');

// استيراد الموديل مع تسميته بحرف كبير لتجنب الالتباس
const SubCategory = require('../models/SubCategoryModel');

// @desc    Get list of subCategories
// @route   GET /api/v1/subcategories
// @route   GET /api/v1/categories/:categoryId/subcategories
// @access  Public
exports.getSubCategories = asyncHandler(async (req, res, next) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 5 : Number(req.query.limit);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(page) || page < 1
        || !Number.isSafeInteger(limit) || limit < 1
        || !Number.isSafeInteger(skip)) {
        return next(new ApiError('page and limit must be positive whole numbers within the supported range.', 400));
    }

    const filter = {};
    const { categoryId } = req.params;
    if (categoryId) {
        const category = await CategoryModel.findById(categoryId);
        if (!category) {
            return next(new ApiError(`Category not found for ID: ${categoryId}.`, 404));
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
        data: subCategories,
    });
});

// @desc    Get specific subCategory by id
// @route   GET /api/v1/subcategories/:id
// @access  Public
exports.getSubCategory = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const subCategory = await SubCategory.findById(id).populate('category', 'name');

    if (!subCategory) {
        return next(new ApiError(`Subcategory not found for ID: ${id}.`, 404));
    }

    return res.status(200).json({ status: 'success', message: 'Subcategory retrieved successfully.', data: subCategory });
});

// @desc    Create subCategory
// @route   POST /api/v1/subcategories
// @access  Private
exports.createSubCategory = asyncHandler(async (req, res, next) => {
    const { name, categoryId } = req.body;

    const category = await CategoryModel.findById(categoryId);
    if (!category) {
        return next(new ApiError(`Parent category not found for categoryId: ${categoryId}.`, 404));
    }
    
    // استخدام SubCategory للإنشاء وتخزين النتيجة في متغير مختلف
    const subCategory = await SubCategory.create({ 
        name, 
        slug: slugify(name), 
        category: categoryId
    });

    await subCategory.populate('category', 'name');
    
    res.status(201).json({ status: 'success', message: 'Subcategory created successfully.', data: subCategory });
});

// @desc    Update specific subCategory
// @route   PUT /api/v1/subcategories/:id
// @access  Private
exports.updateSubCategory = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { name, categoryId } = req.body;
    const update = { name, slug: slugify(name) };

    if (categoryId !== undefined) {
        const category = await CategoryModel.findById(categoryId);
        if (!category) {
            return next(new ApiError(`Parent category not found for categoryId: ${categoryId}.`, 404));
        }
        update.category = categoryId;
    }

    const subCategory = await SubCategory.findByIdAndUpdate(id, update, {
        returnDocument: 'after',
        runValidators: true,
    }).populate('category', 'name');

    if (!subCategory) {
        return next(new ApiError(`Subcategory not found for ID: ${id}.`, 404));
    }

    return res.status(200).json({ status: 'success', message: 'Subcategory updated successfully.', data: subCategory });
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

    return res.status(200).json({ status: 'success', message: 'Subcategory deleted successfully.', msg: 'Deleted successfully' });
});
