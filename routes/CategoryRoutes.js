const express = require('express');
const {
    getCategoryValidator,
    getCategorySubCategoriesValidator,
    createCategoryValidator,
    updateCategoryValidator,
    deleteCategoryValidator,
} = require('../utils/validator/categoryValidator');
const { getSubCategories } = require('../controllers/subCategoryController');

const {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../controllers/CategoryControllers');

const router = express.Router();

router.get('/:categoryId/subcategories', getCategorySubCategoriesValidator, getSubCategories);

router.route('/').get(getCategories).post(createCategoryValidator, createCategory);
router
    .route('/:id')
    .get(getCategoryValidator, getCategory)
    .put(updateCategoryValidator,updateCategory)
    .delete(deleteCategoryValidator,deleteCategory);

module.exports = router;
