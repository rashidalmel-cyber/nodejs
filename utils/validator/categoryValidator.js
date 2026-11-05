const { nameValidator, idValidator } = require('./commonValidators');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getCategoryValidator = [idValidator('category'), validatorMiddleware];

exports.getCategorySubCategoriesValidator = [
  idValidator('category', 'categoryId'),
  validatorMiddleware,
];

exports.createCategoryValidator = [nameValidator('Category'), validatorMiddleware];

exports.updateCategoryValidator = [
  idValidator('category'),
  nameValidator('Category'),
  validatorMiddleware,
];

exports.deleteCategoryValidator = [idValidator('category'), validatorMiddleware];
