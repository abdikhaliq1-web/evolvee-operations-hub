# Step 14 — Deploying (Netlify + Render)

← [Back to README](../../README.md)

---

## 8.1 Push to GitHub first

```powershell
cd path\to\operations-hub
git init
git add .
git commit -m "Initial commit"
```

Create an empty repo on GitHub, then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/operations-hub.git
git push -u origin main
```

`.gitignore` already excludes `node_modules` and `.env`. Never commit `.env`.

`render.yaml` lives at the repo root (next to `netlify.toml`) and must be committed for
the steps below. It's how Render knows what to build.

---

## 8.2 Backend on Render

The repo has a `render.yaml` Blueprint at the root that defines the backend web service
and its PostgreSQL database together, so Render provisions both at once.

1. In the Render Dashboard: New → Blueprint, then Connect the repo. (Connect your GitHub
   account first if you haven't.)
2. Render reads `render.yaml` and lists what it'll create: the `operations-hub-api` web
   service and the `operations-hub-db` Postgres database.
3. It prompts for the environment variables marked `sync: false`. Set `CORS_ORIGIN` to
   your Netlify URL, e.g. `https://your-site.netlify.app`. A trailing slash is fine (it's
   ignored), and you can list several origins comma-separated. If you don't have the final
   Netlify URL yet, enter a placeholder and fix it after step 8.3.
4. Click Apply to deploy the Blueprint. Render builds the service and creates the database.

The Blueprint handles these for you, so you don't set them by hand:

- `DATABASE_URL` is wired to the new Postgres instance (`fromDatabase`).
- `JWT_SECRET` is generated once by Render and kept (`generateValue: true`). It's long and
  random, so it passes the production strength check (32+ chars, no placeholder). Nothing
  to paste.
- Tables are created on first boot (the idempotent schema runs at startup). No manual
  schema step.
- One admin user is seeded on first boot, because `AUTO_SEED=admin` (a live deploy doesn't
  get the demo accounts; use `AUTO_SEED=demo` only for a sandbox). Seeding only runs
  against an empty database, so it can't create duplicates. After the first deploy seeds,
  set `AUTO_SEED` to `false` on the service's Environment page.
- The admin login is set by `ADMIN_EMAIL` (you're prompted for it during Blueprint
  creation). `ADMIN_PASSWORD` is left unset on purpose, so the server generates a strong
  random password and prints it once in the deploy logs (see the note below). To pick the
  password yourself, add `ADMIN_PASSWORD` before the first boot.
- Health checks hit `/api/health`. It returns `200` when the application and the database
  both answer, and `503` when the database query fails. Database TLS is set by
  `DATABASE_CA_CERT` in
  `render.yaml`. Render Postgres uses a certificate that is not in the default CA bundle,
  so you must give the CA. Download the certificate from the database's Connect page, and
  paste it when the Blueprint asks for `DATABASE_CA_CERT`. The backend then verifies the
  server on each connection, and refuses to start in production without it.

  **Caution:** `DATABASE_SSL=no-verify` also starts the server, but it does not verify the
  database server. That setting leaves the connection open to a man-in-the-middle attack.
  Use it only if you cannot get the certificate.
- `CROSS_SITE_COOKIES=true` is set in `render.yaml`. The Netlify site and the Render API
  are different sites, so the session cookie needs `SameSite=None; Secure`. Both ends use
  HTTPS. Keep `CORS_ORIGIN` exact, because it decides which origin can send the cookie.
- Don't add a `PORT` variable. Render assigns the port itself and the backend reads it
  from the environment; setting `PORT` can cause a "no open ports detected" failure.

5. When the deploy is green, note the public backend URL Render assigns, e.g.
   `https://operations-hub-api.onrender.com`. You'll need it for Netlify in 8.3.

> Grab the generated admin password from the deploy logs (Render → the service → Logs).
> It's printed once on first boot as `Generated password (shown ONCE): …`. Sign in as the
> admin, change it on the Team Members page, then add the rest of your team there. (If you
> set `ADMIN_PASSWORD` yourself, use that instead, and still change it after first login.)

### Free instance types, read before go-live

`render.yaml` ships with `plan: free` for both the service and the database so you can
deploy at no cost, but the free tier has limits that matter for an always-on internal tool:

- Free web services spin down after ~15 minutes of inactivity and take about a minute to
  cold-start on the next request.
- Free PostgreSQL databases expire 30 days after creation (with a 14-day grace period to
  upgrade before the data is deleted), are capped at 1 GB, and have no backups.

Before relying on this in production, raise the `plan` field in `render.yaml` for each
resource. `basic-256mb` is the smallest paid Postgres instance, and `starter` or higher
keeps the web service always-on. Then commit and push to re-sync the Blueprint.

### Alternative: configure in the Dashboard without the Blueprint

If you'd rather not use `render.yaml`, create the pieces manually:

1. New → PostgreSQL, pick a region, and create it. Copy its Internal Database URL.
2. New → Web Service, connect the repo, and set: Root Directory = `backend`, Build Command
   = `npm install`, Start Command = `npm start`, Health Check Path = `/api/health`.
3. Under the service's Environment, add these variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | The Internal Database URL. |
   | `DATABASE_CA_CERT` | The database CA certificate, from the database's Connect page. |
   | `JWT_SECRET` | A strong value of 32 characters or more. Use the command below. |
   | `NODE_ENV` | `production` |
   | `CROSS_SITE_COOKIES` | `true` |
   | `CORS_ORIGIN` | The exact Netlify URL. |
   | `AUTO_SEED` and `ADMIN_EMAIL` | `admin` and the first admin address, for the first deploy only. Leave `ADMIN_PASSWORD` unset, and the server prints a password in the logs. |
   | `SHOPIFY_MODE`, `ZOHO_CRM_MODE`, `PARTNER_DASHBOARD_MODE` | `sample` until the credentials arrive. |

   Do not set `PORT`. Do not set `TRUST_PROXY`, because the default of `1` is correct on
   Render.
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

---

## 8.3 Frontend on Netlify

1. In Netlify: Add new site → Import from GitHub → pick the repo.
2. `netlify.toml` at the repo root already sets `base = frontend`, `publish = dist`
   (which resolves to `frontend/dist`), the SPA redirect, and the security headers. Netlify
   reads the file automatically.
   In the `Content-Security-Policy` header, change `connect-src` to your exact backend URL.
   The default value matches any `onrender.com` address. See
   [security.md](../maintenance/security.md).
3. Add one environment variable: `VITE_API_BASE` = your Render backend URL (no trailing
   slash), e.g. `https://operations-hub-api.onrender.com`.
4. Deploy. Then confirm the backend's `CORS_ORIGIN` matches your final Netlify URL (update
   it on the Render service's Environment page if it changed).

---

## 8.4 Post-deploy checklist

- [ ] `render.yaml` committed at the repo root
- [ ] Blueprint applied, `operations-hub-api` service and `operations-hub-db` database
      created
- [ ] `CORS_ORIGIN` (Render) and the Netlify URL match exactly
- [ ] `JWT_SECRET` present (made by Render; 32 characters or more)
- [ ] `DATABASE_CA_CERT` set, and the service starts without a TLS error
- [ ] `CROSS_SITE_COOKIES=true` on Render, and a test sign-in works from the Netlify site
- [ ] `connect-src` in `netlify.toml` points at the Render backend URL
- [ ] The first admin password changed after the first sign-in
- [ ] Single admin seeded once (`AUTO_SEED=admin` + `ADMIN_EMAIL` for first boot, then
      `AUTO_SEED` back to `false`)
- [ ] Admin password retrieved from the deploy logs and changed after first login
- [ ] No `PORT` variable set on the service
- [ ] `VITE_API_BASE` (Netlify) → Render backend URL
- [ ] Paid `plan` set for both resources before production use (free Postgres expires
      after 30 days)
- [ ] Add real API credentials per source as they arrive

---

Next, switch from Sample to Live mode on a deployed site: [going-live.md](going-live.md)

