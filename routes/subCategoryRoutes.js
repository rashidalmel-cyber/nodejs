const express = require('express');
const { createSubCategory } = require('../controllers/subCategoryController');
const {
  createSubCategoryValidator,
} = require('../utils/validator/subCategoryValidator');

const router = express.Router();

router.route('/').post(createSubCategoryValidator, createSubCategory);

module.exports = router;