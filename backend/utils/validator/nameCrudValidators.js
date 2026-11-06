const { nameValidator, idValidator, keywordValidator } = require('./commonValidators');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

module.exports = (label) => ({
  list: [keywordValidator(), validatorMiddleware],
  get: [idValidator(label.toLowerCase()), validatorMiddleware],
  create: [nameValidator(label), validatorMiddleware],
  update: [idValidator(label.toLowerCase()), nameValidator(label), validatorMiddleware],
  delete: [idValidator(label.toLowerCase()), validatorMiddleware],
});
