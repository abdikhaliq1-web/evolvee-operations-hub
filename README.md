# Operations Hub

Internal operations dashboard plus a manufacturer/reorder management tool.

Stack: React (Vite), Node.js/Express, PostgreSQL, JWT auth, node-cron.

This README assumes no prior installations. All commands are PowerShell.

The detailed steps live in [`_docs/setup-help/`](_docs/setup-help/) and are linked below.

---

## Quick start

If you just want it running, three `.bat` files in the repo root do the work. They assume
Node and PostgreSQL are installed and the `opshub` database/role exist, so do
[step 2](_docs/setup-help/prerequisites.md) and [step 3](_docs/setup-help/database-setup.md)
first, then double-click (or run from PowerShell):

| File | What it does |
|---|---|
| `setup-demo.bat` | One-time setup with the full demo dataset (5 role users, manufacturers, products). Sample mode. All demo passwords are `radiance123`. |
| `setup.bat` | One-time setup for a live server: seeds a single admin user, no demo data. Leave `ADMIN_PASSWORD` blank in `backend\.env` and it prints a generated one once. |
| `run-server.bat` | Starts the backend and frontend, each in its own PowerShell window. |

So a fresh demo install is: prerequisites, database, `setup-demo.bat`, `run-server.bat`,
then open http://localhost:5173 (or what is shown on the frontend PS window). Both setup scripts copy `backend\.env.example` to `.env`
if it's missing; review it before relying on a live deploy.

Prefer to do it by hand, or something failed then follow the numbered steps below.

---

## Contents

- [Quick start](#quick-start)
1. [What's in this project](#1-whats-in-this-project)
2. [Install the prerequisites](_docs/setup-help/prerequisites.md)
3. [Set up the database](_docs/setup-help/database-setup.md)
4. [Set up and run the backend](_docs/setup-help/backend-setup.md)
5. [Set up and run the frontend](_docs/setup-help/frontend-setup.md)
6. [Logging in](_docs/setup-help/logging-in.md)
7. [Sample data vs live API mode](_docs/setup-help/sample-vs-live.md)
8. [Troubleshooting](_docs/setup-help/troubleshooting.md)
9. [Project structure reference](_docs/setup-help/project-structure.md)
10. [Browser support](_docs/browser-support.md)
11. [Architecture & maintenance guide](_docs/maintenance/) — for developers changing or maintaining the code
12. [User guide](_docs/user-guide/) — how to use each screen (for the people working in the app)
13. [Developer reference](_docs/reference/) — API, data model, frontend internals, dev workflow

---

## 1. What's in this project

Two systems in one app.

**Operations dashboard**
- Stock levels per SKU with low-stock flags (Shopify)
- Product sales, best and slow sellers (Shopify)
- Top customers (Shopify + Zoho CRM)
- Revenue by day / week / month (Shopify)
- Reorder alerts and manufacturing triggers
- Order and shipping status (Shopify fulfilments)
- QR partner dashboard (currently a placeholder)
- User management (Admin only)

**Manufacturer POC & reorder management**
- Manufacturer and contact records (CRUD)
- SKU-to-manufacturer assignment
- Reorder thresholds per SKU
- Automated stock checks (node-cron) that raise reorder alerts
- Reorder history, communication log, production run tracker

Roles are `admin`, `developer`, `ops_manager`, `marketing`, and `partner`. Each role
sees only the modules it's allowed. Revenue is currently visible to the Ops Manager role;
toggle that in `backend/src/middleware/auth.js`.

---

Continue with [Step 2, install the prerequisites](_docs/setup-help/prerequisites.md).