const express = require('express');
const { getCategories, createCategory } = require('../controllers/CategoryControllers');

const router = express.Router();


router.route('/').get(getCategories).post(createCategory);

module.exports = router;
