const Brand = require('../models/BrandModel');
const createCategoryBrandCrudController = require('./categoryBrandCrudController');

const controller = createCategoryBrandCrudController(Brand, 'Brand', 'Brands', { searchByName: true });

exports.getBrands = controller.list;
exports.getBrand = controller.get;
exports.createBrand = controller.create;
exports.updateBrand = controller.update;
exports.deleteBrand = controller.delete;
