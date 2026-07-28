# Step 6 — Logging in

← [Back to README](../../README.md)

The demo seed (`npm run db:seed`) creates one account per role. Every demo password is
`radiance123`. Change them before any real use (change via the Team Access page with Admin, or re-seed with new
values in `backend/db/seed.js`).

| Email | Role | Sees |
|---|---|---|
| `owner@evolveeradiance.com` | Admin | Everything, including user management |
| `dev@evolveeradiance.com` | Developer | Everything except user management |
| `ops@evolveeradiance.com` | Operations Manager | Inventory, sales, customers, revenue, shipping, alerts, manufacturers |
| `marketing@evolveeradiance.com` | Marketing | Sales, customers, partner module |
| `partner@evolveeradiance.com` | Partner/Ambassador | Partner module only |

Log in as a few different users to confirm each role sees the right tiles and nav items.

---

Next: [Step 7 — Sample data vs live API mode](sample-vs-live.md)
