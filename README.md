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
| `setup-demo.bat` | One-time setup with the full demo dataset (5 role users, manufacturers, products). Sample mode. All demo passwords are `radiance123`. Also installs and seeds the QR partner app and points the hub at it. |
| `setup.bat` | One-time setup for a live server: seeds a single admin user, no demo data. Leave `ADMIN_PASSWORD` blank in `backend\.env` and it prints a generated one once. Also installs the QR partner app and pairs the shared API key. |
| `run-server.bat` | Starts the backend, the frontend, and the QR partner app, each in its own PowerShell window. |

The QR partner app needs [Python](_docs/setup-help/prerequisites.md#23-python-311-optional--qr-partner-app-only).
Both setup scripts skip it with a note if `py` isn't installed — the rest of the hub
still works, with the partner tile on bundled sample data.

So a fresh demo install is: prerequisites, database, `setup-demo.bat`, `run-server.bat`,
then open http://localhost:5173 (or what is shown on the frontend PS window). Both setup scripts copy `backend\.env.example` to `.env`
if it's missing; review it before relying on a live deploy.

Prefer to do it by hand, or something failed then follow the numbered steps below.

---

## Contents

- [Quick start](#quick-start)
- [Roles and access](#roles-and-access)
- [Security](#security)
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
11. [Security controls](_docs/maintenance/security.md) — every control and its setting
12. [Architecture & maintenance reference](_docs/maintenance/architecture.md) — for developers changing the code

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
- QR partner dashboard — program KPIs and partner leaderboard pulled from the
  `evolvee-partners` Django app (bundled sample data until `PARTNER_DASHBOARD_MODE=live`)
- User management (Admin only)

**Manufacturer POC & reorder management**
- Manufacturer and contact records (CRUD)
- SKU-to-manufacturer assignment
- Reorder thresholds per SKU
- Automated stock checks (node-cron) that raise reorder alerts
- Reorder history, communication log, production run tracker

## Roles and access

The roles are `admin`, `developer`, `ops_manager`, `marketing`, and `partner`.

Access has two parts. A role can **see** a module, and a role can **change** a module. The
two parts are separate.

| Role | Sees | Can change |
|---|---|---|
| `admin` | Everything, including user management | Alerts, manufacturers, products, users |
| `developer` | Everything except user management | Alerts, manufacturers, products |
| `ops_manager` | Operations modules and the manufacturer tool | Alerts, manufacturers, products |
| `marketing` | Sales, customers, partner module | Nothing |
| `partner` | Partner module only | Nothing |

`backend/src/middleware/auth.js` holds both maps. `ROLE_PERMISSIONS` says what a role sees.
`WRITE_PERMISSIONS` says what a role changes. To make a role read-only, delete the module
from `WRITE_PERMISSIONS` only.

Revenue is visible to the Ops Manager role. Change the `'revenue'` entry in
`ROLE_PERMISSIONS` to alter this.

Only an Admin or a Developer can delete an alert.

---

## Security

The main controls:

- The session token is in an `HttpOnly` cookie. Page scripts cannot read it.
- Each request that changes data sends a CSRF token in the `X-CSRF-Token` header.
- A password must have 12 characters or more, and must not be easy to guess.
- Sign-out ends the session on the server, on all the user's devices.
- The login endpoint has a limit for each account, and also for each IP address.
- An admin must confirm the admin's own password to change a role, an active state, or a
  password.
- The audit log records each sign-in, each failed sign-in, and each change to a user.

Read [`_docs/maintenance/security.md`](_docs/maintenance/security.md) for the full list, the
settings, and what to do if a credential leaks.

**Warning:** The demo passwords are public. Change each one before real use.

---

Continue with [Step 2, install the prerequisites](_docs/setup-help/prerequisites.md).