const { body, param } = require('express-validator');

const nameValidator = (label, min = 3, max = 32) => body('name')
  .exists().withMessage(`${label} name is required.`).bail()
  .isString().withMessage(`${label} name must be a string.`).bail()
  .trim()
  .notEmpty().withMessage(`${label} name is required.`).bail()
  .isLength({ min, max })
  .withMessage(`${label} name must contain between ${min} and ${max} characters.`);

const idValidator = (label, field = 'id') => param(field)
  .isMongoId()
  .withMessage(`Invalid ${label} ID. Expected 24 hexadecimal characters.`);

module.exports = { nameValidator, idValidator };
