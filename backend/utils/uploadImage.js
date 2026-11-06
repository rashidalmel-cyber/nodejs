const cloudinary = require('cloudinary').v2;
const ApiError = require('./apiError');

const uploadImage = (buffer) => {
  const credentials = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
  if (Object.values(credentials).some((value) => !value || !value.trim())) {
    throw new ApiError('Image upload is not configured. Set the CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.', 503);
  }

  return new Promise((resolve, reject) => {
    const uploadFailed = (error) => {
      // Provider errors may contain account details. Return only a controlled message.
      const invalidImage = error && error.http_code === 400;
      reject(new ApiError(invalidImage
        ? 'The image could not be decoded. Send a valid PNG, JPEG, or WebP image.'
        : 'Image storage is unavailable. Please try again later.', invalidImage ? 400 : 502));
    };

    try {
      const stream = cloudinary.uploader.upload_stream({
        ...credentials,
        resource_type: 'image',
        folder: 'products',
        allowed_formats: ['png', 'jpg', 'jpeg', 'webp'],
        overwrite: false,
        timeout: 30000,
      }, (error, result) => {
        if (error) return uploadFailed(error);
        if (!result || typeof result.secure_url !== 'string'
          || !result.secure_url.startsWith('https://')
          || typeof result.public_id !== 'string' || !result.public_id) {
          return uploadFailed();
        }
        return resolve(result);
      });
      stream.once('error', uploadFailed);
      stream.end(buffer);
    } catch (error) {
      uploadFailed(error);
    }
  });
};

module.exports = uploadImage;
