const Category = require('../models/CategoryModel');
const createCategoryBrandCrudController = require('./categoryBrandCrudController');

const controller = createCategoryBrandCrudController(Category, 'Category', 'Categories', {
  searchByName: true,
});

exports.getCategories = controller.list;
exports.getCategory = controller.get;
exports.createCategory = controller.create;
exports.updateCategory = controller.update;
exports.deleteCategory = controller.delete;
