# Frontend internals

← [Back to reference](README.md) · backend side: [architecture.md](../maintenance/architecture.md)

How the React app is put together — routing, auth/session, the permission model on the client,
and the shared helpers. Everything lives under `frontend/src/`. It's a Vite single-page app;
`main.jsx` mounts `<App/>` inside a `BrowserRouter`.

---

## Entry & shell

- **`main.jsx`** — mounts the app in `#root` wrapped in `BrowserRouter`. Nothing else.
- **`App.jsx`** — the whole frame: route table, the top nav, and the cross-cutting UI pieces
  (`ViewAsControl`, `ImpersonationBanner`, `SessionWatcher`). `Shell` renders the nav +
  active route; if there's no token it redirects to `/login`.

### Routes

| Path | Page |
|---|---|
| `/login` | `Login` |
| `/` | `Dashboard` |
| `/manufacturers`, `/manufacturers/:id` | `Manufacturers`, `ManufacturerDetail` |
| `/products`, `/products/:id` | `Products`, `ProductDetail` |
| `/alerts` | `Alerts` |
| `/production` | `ProductionRuns` |
| `/users` | `Users` (nav label **"Team access"**) |
| `/account` | `Account` |

Unknown paths redirect to `/`.

---

## Auth & session (`api.js`)

`api.js` is both the fetch wrapper **and** the session store. State lives in `localStorage`
under `opshub_token`, `opshub_user`, `opshub_view_as`.

- **`api(path, options)`** — prefixes `/api`, sets JSON headers, attaches
  `Authorization: Bearer <token>`, parses the JSON body, and normalises errors. Base URL from
  `VITE_API_BASE` (empty = same origin; the Vite dev proxy handles local).
- **On `401` it clears the session and hard-redirects to `/login`** — this is why the backend
  must never leak an upstream `401` (it normalises integration failures to `502`; see
  [api.md](api.md)).
- Session helpers: `getToken`, `setSession`, `clearSession`, `getUser`, `setToken`,
  `getTokenExp` (decodes the JWT `exp` client-side, no signature check).

### Session expiry — `SessionWatcher` (`App.jsx`)
Reads the token's `exp`, warns with a banner ~2 minutes before expiry, and on expiry clears the
session and routes to `/login`. (Skips scheduling if the delay would overflow a 32-bit timer.)

---

## Client-side permission model

The server is the real gate — this is only about *what to show*. On login the user object
carries `permissions` (their role's module list) and, for admin/developer, the full
`role_permissions` map.

- **`getEffectivePermissions()`** — the permissions the UI should honour. Normally the real
  ones; while previewing another role it returns that role's permissions **intersected with the
  real user's**, so preview can never reveal more than the user actually has.
- **`viewableRoles()`** — roles offered in the "View as" dropdown: only those whose permissions
  are a subset of the current user's. That's why a non-admin sees no dropdown.
- **`ViewAsControl` / `ImpersonationBanner`** (`App.jsx`) — the dropdown and the "Viewing as …"
  banner with **Exit preview**. Selecting a role stores `opshub_view_as` and reloads.

`Shell` computes `can(p)` from `getEffectivePermissions()` and shows each nav item / route
accordingly.

---

## Shared table helpers

The list pages (Products, Manufacturers, Users, Alerts, dashboard tables) reuse:

- **`tableView.js`** — pure logic: `selectRows(rows, searchFields, query, sort)` (search +
  sort), `compareValues` (null-last, numeric-aware), `toCsv` (CSV with formula-injection
  escaping). Covered by `_docs/integration-tests/tableView.test.mjs`.
  Search supports multi-term AND, quoted phrases, `-` negation, and diacritic-insensitivity.
- **`ui.jsx`** — the React pieces: `useTableView` (wires search+sort state to `selectRows`),
  `SortHeader`, `SearchBox`, `ExportButton`, `CopyText`, `useFlash`, `onEnter`.

## Dashboard helpers

- **`dashboardOrder.js`** — drag-to-reorder for dashboard tiles: `applyOrder`, `reorder`,
  `dropBefore` (pure functions; tile order persists per user). Covered by
  `_docs/integration-tests/dashboardOrder.test.mjs`.
- **`status.js`** — small formatters: `statusPillClass`, `formatStatus`.

---

## Adding a screen (the pattern)

The whole app is one repeated shape — **data source → backend route → React page**:

1. Add/extend a backend route ([api.md](api.md)) behind `authenticate` +
   `requirePermission(<module>)`.
2. Add a page under `pages/`, fetch with `api('/your/path')`, render with the shared
   table helpers where it's a list.
3. Add the route in `App.jsx` and a nav link gated by `can('<module>')`.
4. If it's a new permission module, add the key to `ROLE_PERMISSIONS` in
   `backend/src/middleware/auth.js` — that single map drives both the nav and the server gate.
