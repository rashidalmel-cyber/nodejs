const express = require('express');
const asyncHandler = require('express-async-handler');
const { uploadCover } = require('../controllers/imageUploadController');
const ApiError = require('../utils/apiError');

const router = express.Router();
const parseImageJson = express.json({ limit: '7mb' });
const maxConcurrentUploads = 4;
let activeUploads = 0;

router.post('/upload-cover', asyncHandler(async (req, res, next) => {
  // Reserve capacity before reading JSON so concurrent Base64 bodies stay bounded.
  if (activeUploads >= maxConcurrentUploads) {
    res.set('Retry-After', '1');
    throw new ApiError('Image uploads are busy. Please try again shortly.', 503);
  }
  activeUploads += 1;
  try {
    await new Promise((resolve, reject) => {
      parseImageJson(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await uploadCover(req, res, next);
  } finally {
    // Keep the slot until the upload settles, even if the client disconnects.
    activeUploads -= 1;
  }
}));

module.exports = router;
