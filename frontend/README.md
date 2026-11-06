# مدار — React storefront and administration

Both the storefront and administration support Arabic and English through the header language button. The choice is saved on the device and controls RTL/LTR layout, page titles, form labels, and interface messages. Product names, descriptions, and catalogue records stay in their original language. UI translations are shared in `src/translations.json`, with the language provider in `src/i18n.jsx`.

Tajawal (Arabic) and Roboto (Latin) are bundled locally through Fontsource, including their license files. No external font service is needed. Store containers and the administration content use the shared `--content-width: 1400px` maximum.

Arabic, RTL, responsive React interface for the existing Express API. The storefront includes server-side search, category filtering, sorting, 25-item pages, product galleries, and a device-local shopping bag. The administration area includes catalogue statistics and create/edit/delete forms for products, categories, subcategories, and brands. Product cover uploads use the existing Cloudinary endpoint.

## Local development

Install once from the repository root:

```powershell
npm run install:all
```

Run the backend in one terminal:

```powershell
npm run dev
```

Run the frontend in another terminal:

```powershell
npm run frontend
```

- Store: http://localhost:5173/
- Administration: http://localhost:5173/admin

The Vite development proxy forwards `/api` to `http://127.0.0.1:8000`. For another backend port, copy `.env.example` to `.env.local` and change `API_PROXY_TARGET`. Restart Vite after changing this setting. No database or Cloudinary credentials belong in frontend environment variables.

The frontend and backend are independent sibling packages. From `frontend/`,
you can also use `npm ci`, `npm run dev`, `npm run build`, and `npm run lint`
directly. Backend configuration lives in `../backend/config.env`.

## Build and serve with Express

```powershell
npm run build:frontend
npm start
```

Open http://localhost:8000/ or http://localhost:8000/admin. Express serves the compiled frontend and preserves all `/api/v1` routes. Direct visits and refreshes on React routes work. Deploy the frontend and backend under the same origin, or configure a reverse proxy for `/api`.

## Shared components

- `src/components.jsx`: logo, images, search, pagination, loading/error/empty states, dialogs, product cards, toast.
- `src/api.js`: HTTP errors, paginated reference loading, currency, image file reading.
- `src/hooks.js`: cancellable requests and search debounce.
- `src/Forms.jsx`: one record editor for the catalogue's four resources.
- `src/CartContext.jsx`: local shopping bag shared between routes.
- `src/Store.jsx`: storefront, product details, bag, customer layout.
- `src/Admin.jsx`: dashboard, resource tables, administration layout.

## Current boundaries

The backend has no authentication, checkout, orders, or payments. The admin route is a local development interface, not an access-control boundary. Add server-side authentication and authorization before exposing write endpoints publicly. The shopping bag does not submit orders, reserve inventory, or guarantee historical prices.

Reference selectors and administration tables read paginated records to provide complete lists and correct local counts. Large catalogues should use server-side filtered tables and dedicated aggregation endpoints. The existing API does not support clearing an existing brand, discount, or subcategory relationship; the editor preserves omitted values and requires a replacement subcategory when editing an existing association.

Uploads accept PNG/JPEG/WebP up to 5 MB and need the backend's Cloudinary configuration. Pasting a direct image URL also works. Empty databases and failed API connections display clear states instead of sample data. The decorative hero image is a bundled [DummyJSON product image](https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/1.webp); the actual catalogue always comes from the API.

## Checks

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
npm run test:frontend
```

The browser checks use Playwright Core with the installed Google Chrome (or set `BROWSER_EXECUTABLE` to a Chromium browser path). They start and stop their own Vite server on port 5174, exercise the frontend with an in-memory API, and never touch MongoDB or Cloudinary. Screenshots are saved to the ignored `tests/artifacts/` folder.
