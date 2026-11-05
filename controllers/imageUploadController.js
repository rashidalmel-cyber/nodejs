const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const { decodeBase64Image } = require('../utils/decodeBase64Image');
const uploadImage = require('../utils/uploadImage');

exports.uploadCover = asyncHandler(async (req, res, next) => {
  if (!req.is('application/json')) {
    return next(new ApiError('Send the image as application/json with a base64Image field.', 415));
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(new ApiError('Image upload body must be a JSON object.', 400));
  }

  const buffer = decodeBase64Image(req.body.base64Image);
  const image = await uploadImage(buffer);
  return res.status(200).json({
    success: true,
    imageUrl: image.secure_url,
    publicId: image.public_id,
  });
});
