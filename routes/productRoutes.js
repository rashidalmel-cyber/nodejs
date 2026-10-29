const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productcontrollers');
const {
  getProductsValidator,
  getProductValidator,
  createProductValidator,
  updateProductValidator,
  deleteProductValidator,
} = require('../utils/validator/productValidator');

const router = express.Router();

router.route('/')
  .get(getProductsValidator, getProducts)
  .post(createProductValidator, createProduct);
router.route('/:id')
  .get(getProductValidator, getProduct)
  .put(updateProductValidator, updateProduct)
  .delete(deleteProductValidator, deleteProduct);

module.exports = router;
