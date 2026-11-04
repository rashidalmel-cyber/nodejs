# Search products

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

The keyword must be a single string of at most 200 characters after trimming.
Repeated keyword parameters are rejected with status 400.
