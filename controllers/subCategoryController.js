const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');

// استيراد الموديل مع تسميته بحرف كبير لتجنب الالتباس
const SubCategory = require('../models/SubCategoryModel');

// @desc    Create subCategory
// @route   POST /api/v1/subcategories
// @access  Private
exports.createSubCategory = asyncHandler(async (req, res) => {
    const { name, category } = req.body;
    
    // استخدام SubCategory للإنشاء وتخزين النتيجة في متغير مختلف
    const subCategory = await SubCategory.create({ 
        name, 
        slug: slugify(name), 
        category 
    });
    
    res.status(201).json({ data: subCategory });
});