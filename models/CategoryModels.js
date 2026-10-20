const mongoose = require('mongoose');

// 1- Create Schema
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category required"],
    unique: [true, "category must be unique"],
    minlength: [3, "too short category name"],
    maxlength: [32, "too long category name"],
  },
  slug : {
    type: String,
    lowercase: true,
  },
},
  {timestamps: true}
);

// 2- Create model
const CategoryModel = mongoose.model('Category', categorySchema);

module.exports = CategoryModel;