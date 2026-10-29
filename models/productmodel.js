const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: [3, 'Too short product title'],
            maxlength: [100, 'Too long product title'],
        },
        slug: {
            type: String,
            required: true,
            lowercase: true,
        },
        description: {
            type: String,
            required: [true, 'Product description is required'],
            minlength: [20, 'Too short product description'],
        },
        quantity: {
            type: Number,
            required: [true, 'Product quantity is required'],
            min: [0, 'Product quantity cannot be negative'],
            validate: {
                validator: Number.isSafeInteger,
                message: 'Product quantity must be a whole number within the supported range',
            },
        },
        sold: {
            type: Number,
            default: 0,
        },
        price: {
            type: Number,
            required: [true, 'Product price is required'],
            min: [0, 'Product price cannot be negative'],
        },
        priceAfterDiscount: {
            type: Number,
            min: [0, 'Discounted product price cannot be negative'],
        },
        colors: [String],

        imageCover: {
            type: String,
            required: [true, 'Product image cover is required'],
        },
        images: [String],
        category: {
            type: mongoose.Schema.ObjectId,
            ref: 'Category',
            required: [true, 'product must belong to category'],
        },
        subcategory: [{
            type: mongoose.Schema.ObjectId,
            ref: 'SubCategory',
        }],
        brand: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Brand',
        }],
        ratingsAverage: {
            type: Number,
            min: [1, 'Rating  must be over or equal 1.0'],
            max:  [5, 'Rating  must be below or equal 5.0'],
        },
        ratingsQuantity:{
            type: Number,
             default: 0,
        },


    },
    { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
