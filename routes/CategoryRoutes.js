const express = require('express');
const { getCategoryValidator,createCategoryValidator,updateCategoryValidator,deleteCategoryValidator } = require('../utils/validator/categoryValidator');

const {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../controllers/CategoryControllers');

const router = express.Router();

router.route('/').get(getCategories).post(createCategory);
router
    .route('/:id')
    .get(getCategoryValidator, getCategory)
    .put(updateCategoryValidator,updateCategory)
    .delete(deleteCategoryValidator,deleteCategory);

module.exports = router;
