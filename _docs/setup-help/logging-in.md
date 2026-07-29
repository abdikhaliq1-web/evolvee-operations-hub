# Step 6 — Logging in

← [Back to README](../../README.md)

The demo seed (`npm run db:seed`) makes one account for each role. Each demo password is
`radiance123`.

**Warning:** Change these passwords before any real use. Use the Team access page as an
Admin, or put new values in `backend/db/seed.js` and seed again.

The seed writes the password hash directly, so the seed does not obey the password policy.
You cannot set `radiance123` through the application, because the policy refuses it. The seed
also refuses to run against a remote database.

The password policy applies to each password that you set in the application:

- The password has 12 characters or more.
- The password does not start with a common word.
- The password uses 5 different characters or more.
- The password does not contain the part of the email address before the `@` sign.

| Email | Role | Sees |
|---|---|---|
| `admin@yourdomain.com` | Admin | Everything, including user management |
| `dev@yourdomain.com` | Developer | Everything except user management |
| `ops@yourdomain.com` | Operations Manager | Inventory, sales, customers, revenue*, shipping, alerts, manufacturers |
| `marketing@yourdomain.com` | Marketing | Sales, customers, partner module |
| `partner@yourdomain.com` | Partner/Ambassador | Partner module only |

Sign in as different users. Make sure that each role sees the correct tiles and navigation
items.

Marketing and Partner users have read-only access. Their screens show no buttons and no
forms. This is correct. [access-management.md](../maintenance/access-management.md) lists
which role can change which module.

---

Next: [Step 7 — Sample data vs live API mode](sample-vs-live.md)
