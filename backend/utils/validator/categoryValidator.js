const { idValidator } = require('./commonValidators');
const createNameCrudValidators = require('./nameCrudValidators');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

const validators = createNameCrudValidators('Category');

exports.getCategoriesValidator = validators.list;
exports.getCategoryValidator = validators.get;
exports.getCategorySubCategoriesValidator = [
  idValidator('category', 'categoryId'),
  validatorMiddleware,
];
exports.createCategoryValidator = validators.create;
exports.updateCategoryValidator = validators.update;
exports.deleteCategoryValidator = validators.delete;
