const createNameCrudValidators = require('./nameCrudValidators');

const validators = createNameCrudValidators('Brand');

exports.getBrandsValidator = validators.list;
exports.getBrandValidator = validators.get;
exports.createBrandValidator = validators.create;
exports.updateBrandValidator = validators.update;
exports.deleteBrandValidator = validators.delete;
