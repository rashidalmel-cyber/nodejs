# Sample product catalogue

Source: [DummyJSON products](https://dummyjson.com/docs/products).
These are demonstration products and prices with publicly hosted product photos.

The seed selects exactly 50 products:

| Category | Products | Subcategories |
| --- | ---: | --- |
| electronics | 20 | Phones, Laptops, Tablets |
| Fashion | 15 | Men's Shirts, Men's Shoes, Women's Bags |
| Beauty & Personal Care | 10 | Makeup, Fragrances |
| furniture | 5 | Beds, Sofas, Tables, Chairs, Bathroom Furniture |

Every imported product has an existing category, at least one subcategory belonging
to that category, and a brand. Missing categories, subcategories and brands are
created; existing records are reused by name, ignoring case.

Run from the project directory:

```powershell
# Validate products and image links, save a preview, without database writes.
node scripts/seedProducts.js

# Insert the catalogue into the database configured by config.env.
node scripts/seedProducts.js --apply
```

The script validates the models and checks all image URLs before writing.
Database changes run in a MongoDB transaction; insertion failures roll back the
transaction. Existing records are preserved. Repeating the same import skips
products with the same slug and matching relationships; conflicts abort the import.

The prepared data is saved in `scripts/data/sample-products.json`.
After insertion, `scripts/data/seed-products-report.json` lists the resulting
product IDs and their related category, subcategory and brand IDs.

Check the catalogue in Postman:

```http
GET http://localhost:8000/api/v1/products?limit=100
GET http://localhost:8000/api/v1/products?keyword=iphone
GET http://localhost:8000/api/v1/brands?limit=100
```

Images are external HTTPS URLs; the files are not uploaded to this project.
