# Madar catalogue API

The Express/Mongoose application lives in this directory. It manages products,
categories, subcategories, brands, and image uploads. The React application is
its sibling in `../frontend/`.

Run these commands from `backend/`:

```powershell
npm ci
Copy-Item config.env.example config.env
npm run dev
```

Copy the example only on a new checkout. The existing local `config.env` was
preserved during the reorganisation. Set `DB_URI` to the database connection and
configure Cloudinary credentials for uploads. `PORT` defaults to `8000`.

Use `npm start` without the development watcher and `npm run check` for lint and
mocked startup/API/upload tests. Tests do not connect to MongoDB or modify records.

`app.js` exports Express without opening a port or connecting to MongoDB.
`server.js` loads this directory's `config.env`, connects to MongoDB, and listens.
Once `../frontend/dist/` exists, Express also serves the built React store and
administration routes on the same port.

The repository root provides forwarding commands, so `npm run dev`, `npm start`,
and `npm test` also work there. See [API documentation](../docs/) and the
[project README](../README.md) for installation, frontend commands, and examples.
