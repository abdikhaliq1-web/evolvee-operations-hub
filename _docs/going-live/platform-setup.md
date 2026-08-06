# Platform Setup — Netlify, Render, and Supabase

This document describes how to deploy the Operations Hub application for the first time.
Use this document when you do not have an existing deployment.

**Architecture:**

| Component | Platform | Service |
|---|---|---|
| Frontend | Netlify | Static site |
| Backend API | Render | Node.js web service |
| Database | Supabase | PostgreSQL |

**Related files:**

- [`render.yaml`](../../render.yaml) — Render Blueprint configuration
- [`netlify.toml`](../../netlify.toml) — Netlify build configuration
- [`backend/.env.example`](../../backend/.env.example) — All environment variables with descriptions
- [`_docs/going-live/supabase-migration.md`](supabase-migration.md) — Move an existing Render PostgreSQL database to Supabase
- [`_docs/going-live/deployment.md`](deployment.md) — Step-by-step deploy using the Render Blueprint
- [`_docs/going-live/going-live.md`](going-live.md) — Switch from sample data to live API credentials
- [`_docs/maintenance/security.md`](../maintenance/security.md) — Content Security Policy and security headers

---

## Before you start

Complete the following steps before you deploy.

- [ ] Create a GitHub account and push the project repository.
- [ ] Create a Netlify account at netlify.com.
- [ ] Create a Render account at render.com.
- [ ] Create a Supabase account at supabase.com.

You do not need a credit card for any platform to begin. See Section 4 for free-tier limitations.

---

## 1. Set up the database on Supabase

Do this step first. The backend requires a database connection string before you can deploy.

1. Sign in to the Supabase dashboard.
2. Click **New project**.
3. Enter a project name, for example `operations-hub`.
4. Select the region that is closest to your users.
5. Set a strong database password. Store this password in a secure location.
6. Click **Create new project** and wait approximately two minutes for provisioning to complete.
7. Go to **Project Settings → Database**.
8. Under **Connection string**, select **Transaction** mode.
9. Copy the connection string. It looks like this:

```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

You will use this connection string in Section 2.

> **Free tier note:** The Supabase free tier does not delete your database. There is no expiry.

---

## 2. Deploy the backend on Render

The repository includes [`render.yaml`](../../render.yaml) at the root. This file is a Render Blueprint. It defines the backend web service.

> **Note:** `render.yaml` also defines a Render PostgreSQL database. If you use Supabase for the database, skip the database part of the Blueprint. Follow the manual steps in Section 2.2 instead of using the Blueprint.

### 2.1 Using the Blueprint (Render PostgreSQL — not recommended for production)

1. In the Render dashboard, go to **New → Blueprint**.
2. Connect your GitHub account and select the repository.
3. Render reads `render.yaml` and lists two resources: `operations-hub-api` and `operations-hub-db`.
4. Enter values when prompted. See [`backend/.env.example`](../../backend/.env.example) for descriptions.
5. Click **Apply**.

See [`_docs/going-live/deployment.md`](deployment.md) for full Blueprint instructions.

> **Warning:** The Render free PostgreSQL database expires 30 days after creation. Use Supabase for persistent data.

### 2.2 Manual setup with Supabase (recommended)

1. In the Render dashboard, go to **New → Web Service**.
2. Connect your GitHub account and select the repository.
3. Set the following build options:

   | Option | Value |
   |---|---|
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm ci` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |

4. Under **Environment**, add the following variables:

   | Variable | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | Supabase Transaction mode connection string | From Section 1 |
   | `DATABASE_SSL` | `no-verify` | Required for Supabase TLS |
   | `JWT_SECRET` | A random string of 32 characters or more | See command below |
   | `JWT_EXPIRES_IN` | `8h` | |
   | `NODE_ENV` | `production` | |
   | `CORS_ORIGIN` | Your Netlify site URL | Set after Section 3; use a placeholder now |
   | `AUTO_SEED` | `admin` | Change to `false` after first deploy |
   | `ADMIN_EMAIL` | The first admin email address | |
   | `SHOPIFY_MODE` | `sample` | Change to `live` when credentials are ready |
   | `ZOHO_CRM_MODE` | `sample` | Change to `live` when credentials are ready |
   | `PARTNER_DASHBOARD_MODE` | `sample` | |
   | `PARTNER_DASHBOARD_BASE_URL` | Your partner app URL | |
   | `PARTNER_DASHBOARD_API_KEY` | A shared secret key | Must match `OPS_HUB_API_KEY` in the Django app |

   Do **not** set a `PORT` variable. Render assigns the port automatically.

   Generate a JWT secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Click **Create Web Service**.
6. When the deploy is green, copy the public URL, for example `https://operations-hub-api.onrender.com`. You will use this URL in Section 3.

**After first deploy:**
- Find the generated admin password in Render → your service → **Logs**. It appears once as `Generated password (shown ONCE): …`.
- Sign in and change the password on the Team Members page.
- Set `AUTO_SEED` to `false` on the service's Environment page.

---

## 3. Deploy the frontend on Netlify

The repository includes [`netlify.toml`](../../netlify.toml) at the root. Netlify reads this file automatically.

1. Sign in to Netlify.
2. Go to **Add new site → Import an existing project**.
3. Connect your GitHub account and select the repository.
4. Netlify reads `netlify.toml`. The build settings are pre-configured:

   | Option | Value |
   |---|---|
   | Base directory | `frontend` |
   | Build command | `npm run build` |
   | Publish directory | `dist` |

5. Under **Environment variables**, add:

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE` | Your Render backend URL, no trailing slash |

6. Click **Deploy site**.
7. When the deploy is complete, copy the Netlify site URL, for example `https://your-site.netlify.app`.

**Update the backend CORS setting:**

Go to the Render service → **Environment**. Set `CORS_ORIGIN` to the exact Netlify URL. Save. Render redeploys automatically.

**Update the Content Security Policy:**

In [`netlify.toml`](../../netlify.toml), update the `connect-src` directive in the `Content-Security-Policy` header to your exact Render backend URL. See [`_docs/maintenance/security.md`](../maintenance/security.md).

---

## 4. Free tier limitations

Review these limitations before you use the application in production.

| Platform | Limitation |
|---|---|
| Render (web service, free) | Spins down after 15 minutes of inactivity. Cold start takes approximately one minute. |
| Render (PostgreSQL, free) | Expires 30 days after creation. Capped at 1 GB. No backups. |
| Supabase (free) | 500 MB database storage. 2 GB bandwidth per month. No database expiry. |
| Netlify (free) | 100 GB bandwidth per month. 300 build minutes per month. |

To keep the Render web service always on, change `plan: free` to `plan: starter` in [`render.yaml`](../../render.yaml), commit, and push.

---

## 5. Post-deploy checklist

- [ ] Supabase project created and connection string copied
- [ ] Render web service deployed with `DATABASE_URL` pointing to Supabase
- [ ] `DATABASE_SSL=no-verify` set on the Render service
- [ ] `JWT_SECRET` is 32 characters or more
- [ ] `NODE_ENV=production` set
- [ ] `AUTO_SEED=admin` and `ADMIN_EMAIL` set for first deploy only
- [ ] Admin password retrieved from deploy logs and changed after first login
- [ ] `AUTO_SEED` set to `false` after first deploy
- [ ] Netlify site deployed with `VITE_API_BASE` pointing to the Render backend URL
- [ ] `CORS_ORIGIN` on Render matches the exact Netlify site URL
- [ ] `connect-src` in `netlify.toml` updated to the Render backend URL
- [ ] Health check passes: `https://<your-render-app>.onrender.com/api/health` returns `{ ok: true }`
- [ ] Sign-in works from the Netlify site
- [ ] No `PORT` variable set on the Render service
- [ ] Render plan upgraded from `free` before production use

---

## Next steps

- Switch from sample data to live API credentials: [`_docs/going-live/going-live.md`](going-live.md)
- Migrate an existing Render database to Supabase: [`_docs/going-live/supabase-migration.md`](supabase-migration.md)
