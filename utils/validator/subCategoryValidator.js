const { body } = require('express-validator');
const { nameValidator, idValidator } = require('./commonValidators');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

const subCategoryNameValidator = () => nameValidator('Subcategory', 2);
const subCategoryIdValidator = () => idValidator('subcategory');

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
