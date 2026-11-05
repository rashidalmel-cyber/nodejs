const { nameValidator, idValidator } = require('./commonValidators');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getBrandValidator = [idValidator('brand'), validatorMiddleware];

exports.createBrandValidator = [nameValidator('Brand'), validatorMiddleware];

exports.updateBrandValidator = [
  idValidator('brand'),
  nameValidator('Brand'),
  validatorMiddleware,
];

exports.deleteBrandValidator = [idValidator('brand'), validatorMiddleware];
