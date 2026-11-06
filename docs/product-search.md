# Search and sort products

In Postman, send a GET request (no body):

```http
GET http://localhost:8000/api/v1/products?keyword=iphone
```

Alternatively, open the **Params** tab and add `keyword` with the value `iphone`.
Search matches part of a product's title or description, ignoring case and trimming
leading/trailing whitespace. Special characters are treated as literal text.

Combine search with pagination:

```http
GET http://localhost:8000/api/v1/products?keyword=phone&page=1&limit=10
```

Pagination applies after search. `results` is the number of products returned on
the current page. No matches return status 200 with `results: 0` and `data: []`.
An omitted or blank keyword returns the usual product list.

When `limit` is omitted, up to **25 products** are returned per page. `page`
defaults to `1`. Supply `limit` explicitly to choose a different page size.

Filter by a category ID using `category=<24-character MongoDB ID>`. Category
filtering combines with `keyword`, `sort`, `page`, and `limit` and runs before
pagination. Invalid IDs or duplicate category parameters return status 400.

The keyword must be a single string of at most 200 characters after trimming.
Repeated keyword parameters are rejected with status 400.

## Sorting

Use `sort` to order products by a field. Fields sort in ascending order;
prefix a field with `-` for descending order. Separate multiple fields with
commas, in priority order.

```http
GET http://localhost:8000/api/v1/products?sort=price
GET http://localhost:8000/api/v1/products?sort=-price
GET http://localhost:8000/api/v1/products?sort=price,-ratingsAverage
GET http://localhost:8000/api/v1/products?keyword=phone&sort=-ratingsAverage,price&page=1&limit=10
```

Supported fields: `title`, `slug`, `price`, `priceAfterDiscount`, `quantity`,
`sold`, `ratingsAverage`, `ratingsQuantity`, `createdAt`, `updatedAt`, and `_id`.
Text sorting follows MongoDB's default case-sensitive ordering.

An omitted or blank `sort` returns newest products first (`-createdAt,-_id`).
For explicit sorting, `_id` ascending is added as the final sort field unless
you specify `_id` yourself. This gives products with equal sort values a
consistent order across pages.

Search applies first, sorting second, and pagination last. Repeated `sort`
parameters, unknown fields, empty fields (such as `price,`), and duplicate
fields (such as `price,-price`) return status 400 with an error on `sort`.

## Category, subcategory, and brand names

Product list, single-product, create, and update responses include each linked
record's `_id` and `name`:

```json
{
  "category": { "_id": "507f1f77bcf86cd799439011", "name": "Electronics" },
  "subcategories": [
    { "_id": "507f1f77bcf86cd799439021", "name": "Phones" }
  ],
  "brand": { "_id": "507f1f77bcf86cd799439031", "name": "Apple" }
}
```

Create and update requests still send IDs as strings (`subcategories` is an array
of IDs). An omitted brand remains optional, and unused subcategories return `[]`.
If a linked category or brand has been deleted, its populated value is `null`;
deleted subcategories are omitted from the array.
