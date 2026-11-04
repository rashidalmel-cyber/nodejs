const { body, param } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

const subCategoryNameValidator = () => body('name')
  .exists()
  .withMessage('Subcategory name is required.')
  .bail()
  .isString()
  .withMessage('Subcategory name must be a string.')
  .bail()
  .trim()
  .notEmpty()
  .withMessage('Subcategory name is required.')
  .bail()
  .isLength({ min: 2, max: 32 })
  .withMessage('Subcategory name must contain between 2 and 32 characters.');

const subCategoryIdValidator = () => param('id')
  .isMongoId()
  .withMessage('Invalid subcategory ID. Expected 24 hexadecimal characters.');

const parentCategoryValidator = () => body('category')
  .exists()
  .withMessage('category is required.')
  .bail()
  .isString()
  .withMessage('category must be a string.')
  .bail()
  .notEmpty()
  .withMessage('category is required.')
  .bail()
  .isMongoId()
  .withMessage('Invalid category. Expected 24 hexadecimal characters.');

exports.getSubCategoryValidator = [
  subCategoryIdValidator(),
  validatorMiddleware,
];

exports.createSubCategoryValidator = [
  subCategoryNameValidator(),
  parentCategoryValidator(),
  validatorMiddleware,
];
exports.updateSubCategoryValidator = [
  subCategoryIdValidator(),
  subCategoryNameValidator(),
  parentCategoryValidator().optional(),
  validatorMiddleware,
];

exports.deleteSubCategoryValidator = [
  subCategoryIdValidator(),
  validatorMiddleware,
];
