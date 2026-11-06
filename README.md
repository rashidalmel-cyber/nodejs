# Madar — Storefront and catalogue API

Arabic/English React storefront and administration, backed by an Express and
Mongoose API. The two applications are separate sibling packages in one repository:

```text
nodejs/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── tests/
│   ├── utils/
│   ├── app.js
│   ├── server.js
│   ├── config.env.example
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── public/
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── package-lock.json
├── docs/
├── package.json
└── package-lock.json
```

Each application owns its dependencies and configuration. The root package has
no runtime dependencies; it provides convenient commands for both applications.

## Install and configure

From the repository root:

```powershell
npm run install:all
```

On a new checkout, copy `backend/config.env.example` to `backend/config.env` and
configure `DB_URI`, `PORT` (default `8000`), `NODE_ENV`, and Cloudinary credentials
for image uploads. The existing local configuration was moved intact during the
reorganisation; do not overwrite it with the example. `backend/config.env` is
ignored by Git. Frontend configuration lives in `frontend/.env.local` when needed.

## Develop

Run in separate terminals from the root:

```powershell
# Backend
npm run dev
```

```powershell
# Frontend
npm run frontend
```

- Store: http://localhost:5173/
- Administration: http://localhost:5173/admin
- API: http://localhost:8000/api/v1/products

The frontend proxies `/api` to the backend. To use another backend port, set
`API_PROXY_TARGET` in `frontend/.env.local`. Each package also works directly:
`cd backend` or `cd frontend`, then use its own `npm ci` and `npm run dev`.

## Build and run on one port

```powershell
npm run build:frontend
npm start
```

Express serves `frontend/dist/` from its sibling directory. Open
http://localhost:8000/ or http://localhost:8000/admin. React route refreshes and
the `/api/v1` endpoints are supported by the same server.

## Checks

```powershell
# Backend and frontend lint, then backend startup/API/upload tests
npm run check

# Frontend production build, browser flows, and Express hosting checks
npm run test:frontend
```

Backend tests mock database and Cloudinary operations. Browser tests use an
in-memory API and the installed Chrome browser. These checks do not change live
records or upload real images. See [frontend documentation](frontend/README.md)
and [backend documentation](backend/README.md) for package-specific commands.

## API

`backend/app.js` exports Express without opening a port or connecting to MongoDB.
`backend/server.js` loads its local configuration, connects, and starts listening.
Routes validate input before controllers run. Category and brand controllers
share CRUD behaviour; relationship-specific logic stays in the product and
subcategory controllers. List endpoints default to `page=1` and `limit=25`.

Authentication, orders, and payments are not implemented by the current API.

See [product examples](docs/video-67.md), [product search and sorting](docs/product-search.md),
[brand search](docs/brand-search.md), [category search](docs/category-search.md),
[Base64 image uploads](docs/image-upload.md), and [sample data](docs/sample-products.md).
