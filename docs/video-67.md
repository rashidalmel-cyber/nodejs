# Following the course through video 67

Current lesson: **67-NodeJS (بالعربي): Validate That Subcategories Belong to Category**.

Reference: [Index Academy course source](https://github.com/Boghdady/udemy-build-ecommerce-api-using-nodejs/tree/section-8-product-CRUD-operations).
That branch contains the completed product section, including later lessons. This project currently uses direct CRUD handlers for this stage.

## Product fields

| Field | Shape | Required when creating |
| --- | --- | --- |
| `title` | String, 3–100 characters | Yes |
| `description` | String, 20–2000 characters | Yes |
| `quantity` | Nonnegative whole number | Yes |
| `price` | Nonnegative number, at most 200000 | Yes |
| `imageCover` | Nonempty string | Yes |
| `category` | Existing category ID | Yes |
| `subcategories` | Array of existing subcategory IDs belonging to `category` | No |
| `brand` | One existing brand ID | No |
| `priceAfterDiscount` | Nonnegative number strictly below `price` | No |
| `colors`, `images` | Arrays of nonempty strings | No |
| `sold`, `ratingsQuantity` | Nonnegative whole numbers | No |
| `ratingsAverage` | Number from 1 to 5 | No |

Numeric strings are also accepted and converted to numbers. `slug` is generated from `title`.
Omit `subcategories` when unused; if supplied, it must contain at least one ID. `brand` is a single ID, not an array.
Updates may contain only the fields being changed. Existing values are used when checking discounts and category/subcategory relationships.

## Postman example

Use the port printed by `npm run dev`; the default is `http://localhost:8000`.
For POST and PUT requests, choose **Body → raw → JSON**.

1. `POST /api/v1/categories`:

   ```json
   { "name": "Electronics" }
   ```

   Copy `data._id` as `CATEGORY_ID`.

2. `POST /api/v1/categories/CATEGORY_ID/subcategories`:

   ```json
   { "name": "TV" }
   ```

   The category comes from the URL. Copy `data._id` as `SUBCATEGORY_ID`.
   Alternatively, use `POST /api/v1/subcategories` with `{ "name": "TV", "category": "CATEGORY_ID" }`.

3. `POST /api/v1/brands`:

   ```json
   { "name": "Samsung" }
   ```

   Copy `data._id` as `BRAND_ID`.

4. `POST /api/v1/products` (replace all ID placeholders with the real IDs):

   ```json
   {
     "title": "Samsung Neo 75",
     "description": "A 75-inch smart television with a clear display and streaming apps.",
     "quantity": 10,
     "price": 1000,
     "priceAfterDiscount": 900,
     "imageCover": "samsung-neo-75.jpg",
     "category": "CATEGORY_ID",
     "subcategories": ["SUBCATEGORY_ID"],
     "brand": "BRAND_ID",
     "colors": ["Black"],
     "images": ["samsung-neo-75-back.jpg"]
   }
   ```

   Expect 201. Copy the returned product ID for GET, PUT, and DELETE requests to `/api/v1/products/PRODUCT_ID`.

Image fields currently store text; file uploading is covered later in the course.
Existing JSON success/error messages and validation safeguards are retained. Source filenames remain in the project's `controllers` directory.
