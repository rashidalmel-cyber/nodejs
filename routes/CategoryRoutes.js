const express = require('express');
const { getCategories } = require('../controllers/CategoryControllers');

const router = express.Router();

router.get(['/', '/getCategories'], getCategories);

module.exports = router;
