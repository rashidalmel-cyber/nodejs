# Upload a Base64 product image

The API accepts the image in JSON, uploads it to Cloudinary, and returns its HTTPS
URL. The frontend does not need to call Cloudinary directly or know its API secret.

Configure these server environment variables (or set them in `backend/config.env`):

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Keep credentials out of version control. Restart the server after changing them.

In Postman, select **POST**, **Body > raw > JSON**, and use:

```http
POST http://localhost:8000/api/v1/images/upload-cover
Content-Type: application/json
```

```json
{
  "base64Image": "data:image/png;base64,PASTE_YOUR_IMAGE_BASE64_HERE"
}
```

Raw Base64 without the data URL prefix is also accepted. Supported image types
are PNG (`image/png`), JPEG (`image/jpeg`), and WebP (`image/webp`). The decoded
image must be at most **5 MB (5 MiB)**. This endpoint allows a JSON body up to
7 MiB to accommodate Base64 overhead; other endpoints retain their existing
request size limit.

Up to four upload requests can be processed at once per Node.js process. Extra
requests receive **503** with `Retry-After: 1`, before their JSON is parsed. Retry
these requests after a short delay. Capacity is released on validation failures,
storage failures, and successful uploads.

A successful upload returns HTTP **200**:

```json
{
  "success": true,
  "imageUrl": "https://res.cloudinary.com/your-cloud/image/upload/v123/products/example.png",
  "publicId": "products/example"
}
```

Use the returned `imageUrl` in a product create or update request:

```http
PUT http://localhost:8000/api/v1/products/PRODUCT_ID
Content-Type: application/json
```

```json
{
  "imageCover": "https://res.cloudinary.com/your-cloud/image/upload/v123/products/example.png"
}
```

Upload each additional image separately and send the resulting URLs in `images`.
Uploading an image does not create or modify a product. `publicId` identifies the
asset in Cloudinary for future deletion or management; this endpoint does not
implement asset deletion. The current product model stores the URL only.

Missing or malformed Base64 returns **400**; unsupported image types return
**415**; oversized images return **413**. Missing Cloudinary configuration
returns **503**, and storage service failures return **502**. Errors follow the
API's existing JSON error format and never echo image contents or provider errors.

Like the project's other endpoints, this route currently has no authentication
middleware. Restrict uploads to authorized users before exposing the API publicly.

`npm run check` includes HTTP upload tests with the Cloudinary SDK mocked. These
tests do not upload assets to a real account or modify MongoDB records. They also
cover concurrent uploads and saving the returned URL to a product, then reading
it back through the product API.
