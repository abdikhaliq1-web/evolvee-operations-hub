# Development workflow

← [Back to reference](README.md)

How to work on the code: running it, testing it, the conventions that keep it consistent, and
the invariants not to break. Getting it installed in the first place is the
[setup guide](../setup-help/); this is what to do once it runs.

---

## Run it locally

Two projects, each its own npm install and dev server:

```powershell
cd backend;  npm run dev     # node --watch src/server.js, port 4000
cd frontend; npm run dev     # vite, port 5173, proxies /api → 4000
```

Or the root `run-server.bat` opens both. Backend requires Node ≥ 20.

---

## Tests

### The suite
The backend `test` script runs the suite under `_docs/integration-tests/`:

```powershell
cd backend
npm test                                       # = node ../_docs/integration-tests/run-all.cjs
```

It runs seven checks — three pure unit tests (`tableView`, `productMetrics`,
`dashboardOrder`), the `shopifyReviews` mapping self-check, and three **connectivity** tests
(`shopify`, `zohoCrm`, `customerPurchases`). The connectivity ones make real API calls and
**SKIP** unless that source's `*_MODE=live` with credentials present — expected locally. See
[../integration-tests/README.md](../integration-tests/README.md).

```powershell
node ..\_docs\integration-tests\run-all.cjs --selfcheck   # validate the runner, no network
_docs\test-integrations.bat                               # connectivity only, one summary
```

### Module self-checks

Several modules hold an assert-based self-check. The check runs when you execute the file
directly. The checks are fast, they need no framework, and they cover the difficult logic.

Run the security checks from the `backend` folder. These modules read `backend/.env`, so the
working folder is important:

```powershell
cd backend
node src/middleware/auth.js             # read/write permissions, restricted actions
node src/middleware/session.js          # session cookies and the CSRF check
node src/middleware/rateLimit.js        # the multi-rule rate limiter
node src/middleware/passwordPolicy.js   # the password rules
node src/services/apiClient.js          # cache, retry, and backoff policy
```

Run the frontend check from the repository root:

```powershell
node _docs/integration-tests/tableView.test.mjs   # search, sort, and CSV
```

Each command prints a "passed" message. A failure prints an assertion error and stops.

Write one of these checks for each non-trivial pure function. Do not add a test framework.

### Frontend build
Vite is a build-time dependency, so confirm it still builds after frontend changes:

```powershell
cd frontend; npm run build
```

---

## Branch workflow

- **Branch per feature; no direct commits to the main branch.**
- Keep a change to one concern — don't bundle a dependency bump with a feature; see
  [maintenance/updating-dependencies.md](../maintenance/updating-dependencies.md).
- Before opening a PR: `npm test` green, the app runs, the frontend builds.

---

## Conventions

- **Backend is CommonJS** (`require`), **frontend is ESM** (`import`, `"type": "module"`).
  Don't mix within a project.
- **The repeated shape is data source → backend route → React page.** New screens follow it —
  the step-by-step is in [frontend.md](frontend.md#adding-a-screen-the-pattern).
- **`ROLE_PERMISSIONS` (`backend/src/middleware/auth.js`) is the single source of truth** for
  access. Both the server gate and the client nav read from it. Add a module key there, not in
  two places.
- **Route handlers** are wrapped in `asyncRoute` so they can `throw`; the central
  `errorHandler` shapes the response. Mutations call `recordAudit(req, …)`.
- **All external calls go through `apiClient.callExternal` inside `withSync`** — that's what
  gives you timeouts, retry/backoff, caching, `sync_status` recording, and the **`502`
  normalisation** (never leak an upstream `401`, or the frontend logs the user out). Don't call
  `fetch` to an integration directly.
- **Schema changes are additive idempotent DDL** — pair every new column with
  `ADD COLUMN IF NOT EXISTS`. See [data-model.md](data-model.md#migrations).

---

## Invariants not to break

- One active reorder alert per product (partial unique index). The stock check relies on it.
- `token_version` bump on password change kills existing sessions — keep it on any password
  write.
- Integration errors surface as `502`, never their real upstream status.
- The last active admin can't be demoted or deactivated.

---

## Where things are

| Need | Doc |
|---|---|
| Endpoint contracts | [api.md](api.md) |
| Tables & relationships | [data-model.md](data-model.md) |
| Frontend structure | [frontend.md](frontend.md) |
| System overview | [../maintenance/architecture.md](../maintenance/architecture.md) |
| Security controls | [../maintenance/security.md](../maintenance/security.md) |
