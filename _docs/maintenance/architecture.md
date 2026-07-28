# Architecture & maintenance reference

← [Back to maintenance guide](README.md)

For a developer inheriting the code. What the system is made of, where each concern lives,
and how a request and a data sync actually move through it. Pair this with the file tree in
[setup-help/project-structure.md](../setup-help/project-structure.md).

---

## The shape of it

Two deployables plus a database:

- **Frontend** — React (Vite), a single-page app. Served by Netlify in production.
  Talks to the backend over `/api`. In dev, Vite proxies `/api` to `localhost:4000`.
- **Backend** — Node.js/Express. Served by Render in production. Owns all business logic,
  auth, the database, the external API calls, and the scheduled stock check.
- **Database** — PostgreSQL. Local in dev, a Render Postgres instance in production.

The frontend never talks to Shopify or Zoho directly. Every external call goes through the
backend, so credentials never reach the browser and all the retry/caching/error handling
lives in one place.

---

## Backend layout (`backend/src/`)

| Area | Path | Responsibility |
|---|---|---|
| Entry point | `server.js` | Builds the Express app, mounts routes, serves `/api/health`, starts background tasks after `listen()`. |
| Config | `config/env.js` | Reads and validates every environment variable. Throws on startup if something required is missing or a secret is too weak for a live deploy. |
| Config | `config/db.js` | The `pg` connection pool and the `query()` helper everything else uses. |
| Auth | `middleware/auth.js` | JWT verification (`authenticate`) and role→module permissions (`requirePermission`). The `ROLE_PERMISSIONS` map is the single source of truth for who sees what. |
| Errors | `middleware/errorHandler.js` | Central error handler plus the `asyncRoute` wrapper so async route handlers can throw and still be caught. |
| Routes | `routes/*.js` | One file per resource: `auth`, `users`, `dashboard`, `manufacturers`, `products`, `alerts`, `productionRuns`, `sync`, `audit`. Each mounts under `/api/<name>`. |
| Jobs | `jobs/stockCheck.js` | The node-cron stock check. Compares Shopify stock against `reorder_thresholds` and raises `reorder_alerts`. |
| Integrations | `services/integrations/` | `shopify`, `zohoCrm`, `zohoAuth`. Each knows how to talk to one external API and how to serve bundled sample data instead. |
| API plumbing | `services/apiClient.js` | The single external-call wrapper: timeouts, retry/backoff, in-memory caching, and recording success/failure into `sync_status`. |
| Sample data | `services/sampleData/` | Bundled JSON returned when a source is in `sample` mode — the app is fully usable with no credentials. |

---

## How a request flows

1. Browser calls `GET /api/<something>` with a `Bearer` JWT in the `Authorization` header.
2. `authenticate` verifies the token, loads the user, and checks `is_active` and
   `token_version` (a stale token from before a password reset is rejected here).
3. `requirePermission('<module>')` checks the user's role against `ROLE_PERMISSIONS`.
4. The route handler runs, usually calling a service, which calls the DB and/or an
   integration.
5. Errors thrown anywhere land in `errorHandler`, which shapes a JSON error response.

An upstream failure (Shopify 401, Zoho 5xx) is deliberately **never** passed through as its
real status — `withSync()` in `apiClient.js` normalises it to `502` so a leaked `401`
doesn't trip the frontend's "you've been logged out" interceptor. Keep that invariant if you
touch integration error handling.

---

## How a data sync flows

Each source has a **mode**: `sample`, `live`, or `off` (set by `SHOPIFY_MODE`,
`ZOHO_CRM_MODE`). An integration service wraps its work in `withSync(source, mode, run)`:

- `sample` / `off` → serve bundled JSON (or an empty value), record success.
- `live` → call the real API through `callExternal()`, cache the result briefly
  (`INTEGRATION_CACHE_TTL_MS`, default 60s), and record the outcome.

Every attempt writes a row to `sync_status` (`source`, `mode`, `last_run_at`,
`last_success`, `ok`, `message`). That table is how the app and `/api/health` know whether
data is fresh or a source is failing — see [monitoring-and-health.md](monitoring-and-health.md).

Zoho adds a token step: `zohoAuth.js` exchanges the long-lived refresh token for a
short-lived access token, caches it until ~1 minute before expiry, and exposes
`clearZohoToken()` to force a refresh if the CRM rejects a cached token early.

---

## The scheduled stock check

`jobs/stockCheck.js` runs on the `STOCK_CHECK_CRON` schedule (default `0 * * * *`, hourly)
and once at startup. It:

1. Pulls current stock from Shopify (`getStockLevels`), indexing by both inventory-item id
   and SKU.
2. Reads every `reorder_thresholds` row joined to its product.
3. For each product at or below threshold, inserts a `reorder_alerts` row — unless one is
   already `open`/`acknowledged` (a partial unique index makes this race-safe, so duplicate
   alerts can't pile up).

If it throws, the failure is recorded and logged as `[stock-check] failed`. In sample mode
it runs against the bundled Shopify data, so it works with no credentials.

---

## Frontend layout (`frontend/src/`)

- `api.js` — the fetch wrapper. Attaches the JWT, and on a `401` clears the session and
  redirects to login. This is why the backend must never leak an upstream `401`.
- `App.jsx` — routes plus the permission-filtered nav shell (a user only sees links for
  modules their role allows).
- `pages/` — one component per screen: `Login`, `Dashboard`, `Manufacturers`,
  `ManufacturerDetail`, `Products`, `ProductDetail`, `Alerts`, `ProductionRuns`, `Users`
  (routed at `/users`, shown in the nav as **"Team access"**), and `Account` (self-service
  password change).
- `tableView.js` / `ui.jsx` — shared search/sort/CSV helpers used by the table pages.
- A **"View as"** control (admin/developer only) previews the app as another role — it
  changes only what's *shown*, never what the API allows. A session-expiry warning appears
  ~2 minutes before the JWT lapses.

---

## Database

Schema lives in `backend/db/schema.sql`, applied idempotently by `db/applySchema.js`
(safe to re-run). Core tables: `users`, `manufacturers`, `manufacturer_contacts`,
`products`, `reorder_thresholds`, `reorder_alerts`, `reorder_history`, `communications`,
`production_runs`, `sync_status`, `audit_log`. Details and upkeep in
[database-maintenance.md](database-maintenance.md).
