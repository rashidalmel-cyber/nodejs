const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config({ path: 'config.env' });
const dbConnection = require('./config/database');
const categoryRoute = require('./routes/CategoryRoutes');
const ApiError = require('./utils/apiError');
const globalError = require('./middlewares/errorMiddleware');

// express app
const app = express();

// Middlewares
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
    console.log(`mode: ${process.env.NODE_ENV}`);
}



// Mount Routes
app.use('/api/v1/categories', categoryRoute);


app.all('/{*splat}', (req, res, next) => {
    // Create error and send it to error handling middleware
    next(new ApiError(`Can't find this route: ${req.originalUrl}`, 404));
});

// Return JSON for errors forwarded by routes and middleware.
app.use(globalError);

const PORT = process.env.PORT || 8000;
dbConnection()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`App running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error(`Database Error: ${err.message}`);
        process.exitCode = 1;
    });
