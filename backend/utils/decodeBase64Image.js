const ApiError = require('./apiError');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_LENGTH = 4 * Math.ceil(MAX_IMAGE_BYTES / 3);
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

const imageError = (message, statusCode = 400) => {
  const error = new ApiError(message, statusCode);
  // Do not echo image contents in error responses.
  error.errors = [{ type: 'field', path: 'base64Image', msg: message, location: 'body' }];
  return error;
};

const detectImageType = (buffer) => {
  if (buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return 'image/jpeg';
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).equals(Buffer.from('RIFF'))
    && buffer.subarray(8, 12).equals(Buffer.from('WEBP'))) {
    return 'image/webp';
  }
  return undefined;
};

const decodeBase64Image = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw imageError('base64Image is required and must be a nonempty string.');
  }

  let encoded = value.trim();
  let declaredType;
  if (/^data:/i.test(encoded)) {
    const dataUrl = /^data:([^;,]+);base64,([\s\S]*)$/i.exec(encoded);
    if (!dataUrl) throw imageError('Invalid image data URL. Use data:image/png;base64,... or raw Base64.');
    declaredType = dataUrl[1].toLowerCase();
    if (!allowedTypes.has(declaredType)) {
      throw imageError('Only PNG, JPEG, and WebP images are supported.', 415);
    }
    [, , encoded] = dataUrl;
  }

  if (encoded.length > MAX_BASE64_LENGTH) {
    throw imageError('Image is too large. The maximum decoded image size is 5 MB.', 413);
  }
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    || encoded.length % 4 === 1 || (encoded.includes('=') && encoded.length % 4 !== 0)) {
    throw imageError('base64Image must contain valid Base64 image data.');
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw imageError('Image is too large. The maximum decoded image size is 5 MB.', 413);
  }
  if (buffer.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw imageError('base64Image must contain valid Base64 image data.');
  }

  const detectedType = detectImageType(buffer);
  if (!detectedType) throw imageError('Only PNG, JPEG, and WebP images are supported.', 415);
  if (declaredType && declaredType !== detectedType) {
    throw imageError('The image contents do not match the declared image type.');
  }
  // Cloudinary decodes the actual image before accepting the upload.
  return buffer;
};

module.exports = { decodeBase64Image, MAX_IMAGE_BYTES };
