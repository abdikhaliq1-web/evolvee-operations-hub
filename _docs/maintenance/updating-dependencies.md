# Updating dependencies

← [Back to maintenance guide](README.md)

Keeping the runtime and packages current without breaking a working deploy. `backend` and
`frontend` are separate npm projects — each has its own `package.json`, `node_modules`, and
lockfile, and each is updated independently.

The whole strategy: small, verifiable steps. Update, run the tests, run the app, then
deploy. Never bundle a dependency bump with a feature change — if something breaks you want
to know which one did it.

---

## What's installed

**Backend** (`backend/package.json`, requires Node ≥ 20):
`express`, `pg`, `jsonwebtoken`, `bcryptjs`, `node-cron`, `cors`, `dotenv`.

**Frontend** (`frontend/package.json`):
`react`, `react-dom`, `react-router-dom`, `recharts`; dev-tooling `vite`,
`@vitejs/plugin-react`.

Small, stable, well-known libraries. There's little churn here — updates are mostly security
patches, not constant version-chasing.

---

## Monthly: security patches

In **each** of `backend/` and `frontend/`:

```powershell
npm audit                 # list known vulnerabilities
npm audit fix             # apply non-breaking fixes (patch/minor within your ranges)
```

`npm audit fix` only takes safe, in-range updates. It will *tell* you about fixes that need a
major-version bump but won't apply them — those get the deliberate treatment below.

---

## Deliberate upgrades (minor/major bumps)

One package (or one project) at a time:

```powershell
cd backend                # or frontend
npm outdated              # see current vs wanted vs latest
npm install <pkg>@latest  # bump the one you chose
```

Then verify before trusting it — see below. Read the release notes for any **major** bump
(`express` 4→5, a `pg` major, a React major); majors carry breaking changes and deserve their
own commit and their own test run.

---

## Verify before you deploy

Backend has a test suite — the integration tests in [`../integration-tests/`](../integration-tests/):

```powershell
cd backend
npm test                  # runs ../_docs/integration-tests/run-all.cjs
```

Then run the app for real and click through the main screens:

- Start it (`npm run dev` in `backend`, `npm run dev` in `frontend`) and sign in.
- Load Dashboard, Products, Manufacturers, Alerts.
- Trigger a stock check ("Run check now" on Alerts).

There are also the small self-checks embedded in some modules (e.g.
`node backend/src/services/apiClient.js`, `node _docs/integration-tests/tableView.test.mjs`) —
quick sanity runs on the pieces they cover.

For the frontend, confirm it still **builds**, since Vite is a build-time dependency:

```powershell
cd frontend
npm run build
```

Only after tests pass, the app runs, and the frontend builds do you commit the updated
`package.json` + lockfile and deploy.

---

## Bumping Node or PostgreSQL

**Node** — backend requires ≥ 20. To move the whole app to a newer major:
- Locally: install the new Node, `npm ci` in each project, run the tests and the app.
- Render: set the Node version (in `render.yaml` or the service's environment) and redeploy.
- Keep local and Render on the same major so "works on my machine" stays meaningful.

**PostgreSQL** — a major-version upgrade of the database:
- Take a backup first ([database-maintenance.md](database-maintenance.md)) — always.
- On Render, follow their managed-Postgres upgrade path (typically create the new version,
  restore the dump into it, repoint `DATABASE_URL`).
- The schema is standard SQL with no version-specific features, so the app itself doesn't
  care which supported major it runs on.

---

## Lockfiles

Commit `package-lock.json` for both projects. Deploys should install with `npm ci` (exact
lockfile versions), not `npm install`, so production matches what you tested. If you ever see
"works locally, breaks on deploy," a drifted lockfile is the first suspect — delete
`node_modules`, `npm ci`, and retest.
