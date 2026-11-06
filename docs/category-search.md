# Search categories

In Postman, use **GET** with no request body:

```http
GET http://localhost:8000/api/v1/categories?page=1&limit=10&keyword=pr
```

In the **Params** tab, add `keyword` with the category name or part of it.
Search matches `name`, ignores case, and trims leading/trailing whitespace.
For example, `keyword=pr` matches `Printers` and `Premium accessories`.

Special characters are treated literally. Search runs before pagination.
`results` counts the returned records on the current page. No matches return
HTTP 200 with `results: 0` and `data: []`.

Omitting `keyword` or sending a blank value returns the usual category list.
Pagination defaults remain `page=1` and `limit=25` unless provided explicitly.
The keyword must be a single string of at most 200 characters after trimming.
Repeated `keyword` parameters or longer values return HTTP 400 with an error
on `keyword`.
