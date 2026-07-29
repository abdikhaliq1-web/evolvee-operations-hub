# Step 8 — Troubleshooting

← [Back to README](../../README.md)

---

## "node" or "psql" is not recognized {#node-or-psql-is-not-recognized}

The program isn't on your PATH.

- Node: reinstall from nodejs.org and open a *new* PowerShell window afterwards.
- psql: add PostgreSQL's bin folder to PATH. Start → "Edit the system environment
  variables" → Environment Variables → under *System variables* select `Path` → Edit →
  New → add `C:\Program Files\PostgreSQL\16\bin` → OK out of everything → open a new
  PowerShell window.

---

## "password authentication failed for user opshub"

The password in `DATABASE_URL` (in `backend/.env`) doesn't match what you set in step 3.
Fix either side. To reset the DB user's password:

```powershell
psql -U postgres -c "ALTER USER opshub WITH PASSWORD 'opshub_dev_password';"
```

---

## "database operations_hub does not exist"

You skipped step 3, or created it under a different name. Re-run the `CREATE DATABASE`
line from [step 3](database-setup.md).

---

## "ECONNREFUSED" / "Cannot reach the server" in the browser

The backend isn't running, or it's on a different port.

1. Check the backend window. Is `npm start` still running without errors?
2. Open http://localhost:4000/api/health directly. If that fails, restart the backend and
   read its console output.
3. Make sure `PORT=4000` in `backend/.env` matches the proxy target in
   `frontend/vite.config.js` (both default to 4000).

---

## "Port 4000 is already in use" (EADDRINUSE)

Something else (probably an old backend window) holds the port:

```powershell
netstat -ano | findstr :4000
taskkill /PID <the_PID_from_above> /F
```

Or change `PORT` in `.env` and the proxy target in `vite.config.js` to match.

---

## PostgreSQL service isn't running

```powershell
Get-Service postgresql*        # check status
Start-Service postgresql-x64-16
```

Or use the Services app: Win+R → `services.msc` → find "postgresql-x64-16" → Start.

---

## CORS error in the browser console

This must not happen locally, because the Vite proxy prevents CORS. If you see this error,
the frontend and the backend are on different origins with no proxy between them.

On a real deployment, make sure that `CORS_ORIGIN` on the backend contains the exact
frontend URL. The session cookie travels only to an origin on that list.

---

## Signed out without warning, or `401` errors

The session expires after `JWT_EXPIRES_IN`. The default is 8 hours. Sign in again.

If this happens immediately after a sign-in, `JWT_SECRET` changed between the two requests.
A restart with a different `.env` file causes this. Sign in again.

A sign-out on one device also ends the session on every other device of the same user. This
is correct behaviour.

---

## `403` with "Request could not be verified"

The CSRF check failed. Refresh the page and try again.

If it continues, the `opshub_csrf` cookie is not reaching the browser, or the client does
not send the `X-CSRF-Token` header. Check these two settings:

- `CORS_ORIGIN` on the backend contains the exact frontend URL.
- `CROSS_SITE_COOKIES` is `true` only when both ends use HTTPS.

**Caution:** With `CROSS_SITE_COOKIES=true` on an HTTP address, the browser refuses the
cookie and nobody can sign in.

---

## `403` with "has read-only access to this module"

The role can see the module but cannot change it. This is correct behaviour, not a fault.
`WRITE_PERMISSIONS` in `backend/src/middleware/auth.js` holds the list. See
[access-management.md](../maintenance/access-management.md).

---

## The new password is refused

The password policy refuses a password that is too short or too easy to guess. The message
tells you which rule failed.

A password must obey all of these rules:

- The password has 12 characters or more.
- The password does not start with a common word.
- The password uses 5 different characters or more.
- The password does not contain the part of your email address before the `@` sign.

---

## `429 Too many attempts`

The rate limiter stopped the request. For a sign-in, wait 15 minutes. For the Shopify sync
or the stock check, wait one minute. [security.md](../maintenance/security.md) lists each
limit.

---

## npm install fails

- Behind a proxy/VPN? Try it off the VPN.
- `EPERM` / file-lock errors on Windows: close any editors or terminals using the folder,
  delete `node_modules` and `package-lock.json`, and re-run `npm install`.
- Make sure you're in the right folder. `backend` and `frontend` each get their own
  `npm install`.

---

## Seed script says "Database already has users — skipping"

That's the safety guard. Seeding only runs on an empty database, so it can't create
duplicates. To wipe and re-seed in development:

```powershell
npm run db:reset    # drops all tables and re-creates them (warning: DESTRUCTIVE)
npm run db:seed
```

Don't do this against a production database with real data.

---

## No reorder alerts showing

Alerts come from the stock check (at startup and hourly). Click Run check now on the
Alerts page to trigger one immediately. In sample mode, 4 of the 8 SKUs are below
threshold and should produce alerts.

---

Next: [Step 10 — Project structure reference](project-structure.md)
