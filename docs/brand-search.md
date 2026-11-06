# Search brands

In Postman, use **GET** with no request body:

```http
GET http://localhost:8000/api/v1/brands?page=1&limit=10&keyword=Huawei
```

In the **Params** tab, add `keyword` with the brand name or part of it. Search
matches the brand's `name`, ignores case, and trims leading/trailing whitespace.
For example, `keyword=uaw` also matches `Huawei`.

Special characters are treated literally: `keyword=Huawei%2B` searches for
`Huawei+`. Search runs before pagination. `results` counts the returned records
on the current page. No matches return HTTP 200 with `results: 0` and `data: []`.

Omitting `keyword` or sending a blank value returns the usual brand list.
Pagination defaults remain `page=1` and `limit=25` unless provided explicitly.
The keyword must be a single string of at most 200 characters after trimming.
Repeated `keyword` parameters or longer values return HTTP 400 with an error
on `keyword`.
