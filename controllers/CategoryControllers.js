const CategoryModel = require('../models/CategoryModels');

exports.getCategories = async (req, res) => {
  try {
    const categories = await CategoryModel.find();
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Unable to fetch categories' });
  }
};
