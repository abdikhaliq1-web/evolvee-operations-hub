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
Several modules embed an assert-based self-check that runs when the file is executed directly —
fast, dependency-free sanity checks on the tricky logic:

```powershell
node backend/src/services/apiClient.js        # cache + retry/backoff policy
node backend/src/routes/auth.js               # login rate limiter
node backend/src/routes/products.js           # product upsert builder
node _docs/integration-tests/tableView.test.mjs   # search/sort/CSV
```

Add one of these for any non-trivial pure function rather than reaching for a framework.

### Frontend build
Vite is a build-time dependency, so confirm it still builds after frontend changes:

```powershell
cd frontend; npm run build
```

---

## Branch workflow

- **Branch per feature; no direct commits to the main branch.** (From the
  [onboarding plan](../deployment/onboarding-and-growth-plan.md).)
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
| Roadmap & roles | [../deployment/onboarding-and-growth-plan.md](../deployment/onboarding-and-growth-plan.md) |
