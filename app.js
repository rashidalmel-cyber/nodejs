const express = require('express');
const morgan = require('morgan');
const categoryRoute = require('./routes/CategoryRoutes');
const subcategoryRoute = require('./routes/subCategoryRoutes');
const brandRoute = require('./routes/brandroute');
const productRoute = require('./routes/productRoutes');
const imageUploadRoute = require('./routes/imageUploadRoutes');
const ApiError = require('./utils/apiError');
const globalError = require('./middlewares/errorMiddleware');

const app = express();

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Upload requests have their own JSON parser and body limit.
app.use('/api/v1/images', imageUploadRoute);
app.use(express.json());

app.use('/api/v1/categories', categoryRoute);
app.use('/api/v1/subcategories', subcategoryRoute);
app.use('/api/v1/brands', brandRoute);
app.use('/api/v1/products', productRoute);

app.use((req, res, next) => {
  next(new ApiError(
    `Route not found: ${req.method} ${req.originalUrl}. Check the URL, HTTP method, and any required ID.`,
    404
  ));
});

app.use(globalError);

module.exports = app;
