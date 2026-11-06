const express = require('express');
const {
  getCategoriesValidator,
  getCategoryValidator,
  getCategorySubCategoriesValidator,
  createCategoryValidator,
  updateCategoryValidator,
  deleteCategoryValidator
} = require('../utils/validator/categoryValidator');
const subcategoriesRoute = require('./subCategoryRoutes');

const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/CategoryControllers');

const router = express.Router();

router.use(
  '/:categoryId/subcategories',
  getCategorySubCategoriesValidator,
  subcategoriesRoute
);

router
  .route('/')
  .get(getCategoriesValidator, getCategories)
  .post(createCategoryValidator, createCategory);
router
  .route('/:id')
  .get(getCategoryValidator, getCategory)
  .put(updateCategoryValidator, updateCategory)
  .delete(deleteCategoryValidator, deleteCategory);

module.exports = router;
