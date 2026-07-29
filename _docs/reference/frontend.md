# Frontend internals

← [Back to reference](README.md) · backend side: [architecture.md](../maintenance/architecture.md)

How the React app is put together — routing, auth/session, the permission model on the client,
and the shared helpers. Everything lives under `frontend/src/`. It's a Vite single-page app;
`main.jsx` mounts `<App/>` inside a `BrowserRouter`.

---

## Entry & shell

- **`main.jsx`** — mounts the app in `#root` wrapped in `BrowserRouter`. Nothing else.
- **`App.jsx`** — the whole frame: route table, the top nav, and the cross-cutting UI pieces
  (`ViewAsControl`, `ImpersonationBanner`, `SessionWatcher`). `Shell` renders the nav and the
  active route. If there is no session, `Shell` redirects to `/login`.

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

## Auth and session (`api.js`)

`api.js` is the fetch wrapper and the session store.

**The session token is not in the browser storage.** The server keeps the token in the
`HttpOnly` cookie `opshub_token`, which this code cannot read. `localStorage` holds only
`opshub_user`, `opshub_expires_at`, and `opshub_view_as`. If an attacker runs a script in the
page, the script finds no token.

- **`api(path, options)`** — adds the `/api` prefix, sets the JSON headers, adds the
  `X-CSRF-Token` header, and sends `credentials: 'include'` so the browser attaches the
  cookie. It then parses the JSON body and makes the errors consistent. The base URL comes
  from `VITE_API_BASE`. An empty value means the same origin, which the Vite proxy handles in
  development.
- **A `401` clears the session and goes to `/login`.** For this reason the backend must never
  send an upstream `401`. It changes each integration failure to `502`. See [api.md](api.md).
- **`signOut()`** — calls `POST /api/auth/logout` first, then clears the local data. The
  server deletes the cookie and increases `token_version`. If the client only cleared
  `localStorage`, a copied token would continue to work until it expired.
- Session helpers: `hasSession`, `setSession`, `setExpiry`, `clearSession`, `getUser`,
  `getTokenExp`.

`getCsrfToken()` reads the `opshub_csrf` cookie. That cookie is not `HttpOnly`, because the
client must send the value back in a header. This is the double-submit CSRF check.

### Session expiry — `SessionWatcher` (`App.jsx`)

The server sends `expires_at` at login. `getTokenExp()` reads the stored value, because the
client can no longer decode the token. `SessionWatcher` shows a banner about 2 minutes before
the session ends. At the end it clears the session and goes to `/login`. It does not set a
timer if the delay is more than a 32-bit value.

---

## Client-side permission model

The server is the real gate. This part only decides **what to show**. At login the user
object carries:

| Field | Content |
|---|---|
| `permissions` | The modules the role can see. |
| `writable` | The modules the role can change. |
| `role_permissions`, `role_writable` | The full maps, for `admin` and `developer` only. |
| `alert_delete_roles` | The roles that can delete an alert. |

- **`getEffectivePermissions()`** — the permissions the UI should honour. Normally the real
  ones; while previewing another role it returns that role's permissions **intersected with the
  real user's**, so preview can never reveal more than the user actually has.
- **`getEffectiveWritable()` / `canWrite(module)`** — the same rule for write access. A page
  calls `canWrite('manufacturers')` and then hides its forms, buttons, and bulk controls, or
  it disables the row inputs.
- **`canDeleteAlerts()`** — `true` only if the role can change alerts and the role is in
  `alert_delete_roles`. The server sends that list, so the rule is not written twice.
- **`viewableRoles()`** — roles offered in the "View as" dropdown: only those whose permissions
  are a subset of the current user's. That's why a non-admin sees no dropdown.
- **`ViewAsControl` / `ImpersonationBanner`** (`App.jsx`) — the dropdown and the "Viewing as …"
  banner with **Exit preview**. Selecting a role stores `opshub_view_as` and reloads.

`Shell` computes `can(p)` from `getEffectivePermissions()` and shows each nav item and route
accordingly.

**Important:** Hide the control and guard the handler. Several inputs send the form when the
user presses Enter. If you hide only the button, that path still calls the API and gets
`403`. The pages therefore also start each write function with a `writable` test.

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

1. Add or extend a backend route ([api.md](api.md)) behind `authenticate`,
   `requirePermission(<module>)`, and `requireWrite(<module>)`.
2. Add a page under `pages/`, fetch with `api('/your/path')`, render with the shared
   table helpers where it's a list.
3. Add the route in `App.jsx` and a nav link gated by `can('<module>')`.
4. For a new module, add the key to `ROLE_PERMISSIONS` in
   `backend/src/middleware/auth.js`. Add the key to `WRITE_PERMISSIONS` for each role that
   must change the module. Those two maps drive the nav and the server gate.
5. Gate each write control with `canWrite('<module>')`, and start each write function with the
   same test.
