const { body, param } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

const brandNameValidator = () => body('name')
  .exists()
  .withMessage('Brand name is required.')
  .bail()
  .isString()
  .withMessage('Brand name must be a string.')
  .bail()
  .trim()
  .notEmpty()
  .withMessage('Brand name is required.')
  .bail()
  .isLength({ min: 3, max: 32 })
  .withMessage('Brand name must contain between 3 and 32 characters.');

const brandIdValidator = () => param('id')
  .isMongoId()
  .withMessage('Invalid brand ID. Expected 24 hexadecimal characters.');

exports.getBrandValidator = [
  brandIdValidator(),
  validatorMiddleware,
];

exports.createBrandValidator = [
  brandNameValidator(),
  validatorMiddleware,
];

exports.updateBrandValidator = [
  brandIdValidator(),
  brandNameValidator(),
  validatorMiddleware,
];

exports.deleteBrandValidator = [
  brandIdValidator(),
  validatorMiddleware,
];
