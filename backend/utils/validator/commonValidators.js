const { body, param, query } = require('express-validator');

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

const keywordValidator = () => query('keyword').optional()
  .isString().withMessage('keyword must be a single string.').bail()
  .trim()
  .isLength({ max: 200 }).withMessage('keyword must contain at most 200 characters.');

module.exports = { nameValidator, idValidator, keywordValidator };
