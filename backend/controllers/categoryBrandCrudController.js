const slugify = require('slugify');
const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const getPagination = require('../utils/pagination');
const escapeRegex = require('../utils/escapeRegex');

// Categories and brands share the same name/slug CRUD behavior.
// Route validators check and normalize input before these handlers run.
const createCategoryBrandCrudController = (Model, singular, plural, { searchByName = false } = {}) => ({
  list: asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (searchByName && req.query.keyword) {
      const keyword = req.query.keyword.trim();
      if (keyword) {
        filter.name = { $regex: escapeRegex(keyword), $options: 'i' };
      }
    }
    const records = await Model.find(filter).skip(skip).limit(limit);
    res.status(200).json({
      status: 'success',
      message: records.length
        ? `${plural} retrieved successfully.`
        : `No ${plural.toLowerCase()} found.`,
      results: records.length,
      page,
      limit,
      data: records,
    });
  }),

  get: asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const record = await Model.findById(id);
    if (!record) return next(new ApiError(`${singular} not found for ID: ${id}.`, 404));
    res.status(200).json({
      status: 'success',
      message: `${singular} retrieved successfully.`,
      data: record,
    });
  }),

  create: asyncHandler(async (req, res) => {
    const { name } = req.body;
    const record = await Model.create({ name, slug: slugify(name) });
    res.status(201).json({
      status: 'success',
      message: `${singular} created successfully.`,
      data: record,
    });
  }),

  update: asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { name } = req.body;
    const record = await Model.findByIdAndUpdate(
      id,
      { name, slug: slugify(name) },
      { returnDocument: 'after', runValidators: true }
    );
    if (!record) return next(new ApiError(`${singular} not found for ID: ${id}.`, 404));
    res.status(200).json({
      status: 'success',
      message: `${singular} updated successfully.`,
      data: record,
    });
  }),

  delete: asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const record = await Model.findByIdAndDelete(id);
    if (!record) return next(new ApiError(`${singular} not found for ID: ${id}.`, 404));
    res.status(200).json({
      status: 'success',
      message: `${singular} deleted successfully.`,
      msg: 'Deleted successfully',
    });
  }),
});

module.exports = createCategoryBrandCrudController;
