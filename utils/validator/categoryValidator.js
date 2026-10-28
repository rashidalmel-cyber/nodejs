const { body, param } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

const categoryNameValidator = () => body('name')
  .exists()
  .withMessage('Category name is required.')
  .bail()
  .isString()
  .withMessage('Category name must be a string.')
  .bail()
  .trim()
  .notEmpty()
  .withMessage('Category name is required.')
  .bail()
  .isLength({ min: 3, max: 32 })
  .withMessage('Category name must contain between 3 and 32 characters.');

const categoryIdValidator = (field = 'id') => param(field)
  .isMongoId()
  .withMessage('Invalid category ID. Expected 24 hexadecimal characters.');

exports.getCategoryValidator = [
  categoryIdValidator(),
  validatorMiddleware,
];

exports.getCategorySubCategoriesValidator = [
  categoryIdValidator('categoryId'),
  validatorMiddleware,
];

exports.createCategoryValidator = [
  categoryNameValidator(),
  validatorMiddleware,
];

exports.updateCategoryValidator = [
  categoryIdValidator(),
  categoryNameValidator(),
  validatorMiddleware,
];

exports.deleteCategoryValidator = [
  categoryIdValidator(),
  validatorMiddleware,
];
