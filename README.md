# Catalogue API

Express and Mongoose API for categories, subcategories, brands, and products.

```sh
npm ci
npm run dev
```

Configure `DB_URI`, `PORT` (default `8000`), and `NODE_ENV` in `config.env`.
Use `npm start` to run without the development watcher.

```sh
npm run check
```

This runs ESLint and the startup/API regression suites. Tests use a real local
HTTP server and Mongoose schemas with database operations mocked. They do not
connect to MongoDB or change database records. Live database integration is not
covered by these checks.

`app.js` configures and exports the Express application without connecting to the
database or opening a port. `server.js` loads configuration, connects to MongoDB,
and starts listening. Importing either module does not start the server.

Routes validate request bodies and IDs before calling controllers. Category and
brand controllers share their name/slug CRUD implementation; products and
subcategories keep their relationship-specific logic. List endpoints default to
`page=1` and `limit=5`; products default to `limit=25`. Pagination parameters must
be positive decimal integers. Duplicate parameters and unsafe page offsets return
status 400. Product responses include `_id` and `name` for the category, brand,
and each subcategory.

See [product examples](docs/video-67.md), [product search and sorting](docs/product-search.md),
[Base64 image uploads](docs/image-upload.md), and [sample data](docs/sample-products.md)
for API usage.
