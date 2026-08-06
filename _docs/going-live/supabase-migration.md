# Database Migration — Render PostgreSQL to Supabase

**Purpose:** Move the Operations Hub database from Render's free PostgreSQL instance to Supabase. Render deletes free PostgreSQL databases after 90 days.

**Applies to:** Node.js backend (`backend/`) and Django partner app (`evolvee-partners/`).

**Date:** 2026-08-05

---

## 1. Before you start

Collect the following items before you do any migration steps.

| Item | Where to find it |
|---|---|
| Current Render `DATABASE_URL` | Render dashboard → your PostgreSQL service → Info tab |
| Supabase project URL and password | Supabase dashboard → Project Settings → Database |
| `pg_dump` command available on your machine | Run `pg_dump --version` to confirm |

Install `pg_dump` if it is not available. It is part of the PostgreSQL client tools.

---

## 2. Create a Supabase project

1. Go to supabase.com and sign in.
2. Click **New project**.
3. Select the region that is closest to the Render region you use now.
4. Set a strong database password. Store it in a secure location.
5. Wait for the project to finish provisioning. This takes approximately two minutes.
6. Go to **Project Settings → Database**.
7. Copy the **Connection string** under **Connection Pooling**. Use the **Transaction** mode URI. It looks like this:

```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## 3. Export data from Render

Run the following command on your local machine. Replace `$RENDER_DATABASE_URL` with your Render connection string.

```bash
pg_dump --no-owner --no-acl -Fc -d "$RENDER_DATABASE_URL" -f render-backup.dump
```

This command creates a compressed backup file named `render-backup.dump`. Do not delete this file until you confirm the migration is complete.

---

## 4. Import data into Supabase

Run the following command. Replace `$SUPABASE_DATABASE_URL` with the Supabase connection string from Section 2.

```bash
pg_restore --no-owner --no-acl -d "$SUPABASE_DATABASE_URL" render-backup.dump
```

If the schema is new and contains no data, run the schema file first, then import data only:

```bash
psql "$SUPABASE_DATABASE_URL" -f backend/db/schema.sql
pg_restore --no-owner --no-acl --data-only -d "$SUPABASE_DATABASE_URL" render-backup.dump
```

---

## 5. Update environment variables — Node backend

Go to the Render dashboard. Open the backend web service (not the PostgreSQL service). Update the environment variables as follows.

| Variable | New value |
|---|---|
| `DATABASE_URL` | Supabase Transaction mode connection string (from Section 2) |
| `DATABASE_SSL` | `no-verify` |
| `DATABASE_CA_CERT` | Remove this variable. It is not required for Supabase. |

> **Why `DATABASE_SSL=no-verify`:** The Supabase connection string includes TLS. The Node backend (`backend/src/config/db.js`) requires a CA certificate or an explicit `no-verify` flag when it connects to a non-local host in production. Use `no-verify` unless your security policy requires certificate verification.

---

## 6. Update environment variables — Django partner app

Go to the Render dashboard. Open the `evolvee-partners` web service. Update the environment variables as follows.

| Variable | New value |
|---|---|
| `DB_ENGINE` | `django.db.backends.postgresql` |
| `DB_NAME` | `postgres` |
| `DB_USER` | `postgres.[ref]` (from Supabase connection string) |
| `DB_PASSWORD` | Your Supabase database password |
| `DB_HOST` | `aws-0-[region].pooler.supabase.com` |
| `DB_PORT` | `6543` |

Find the values for `[ref]` and `[region]` in the Supabase connection string you copied in Section 2.

---

## 7. Redeploy both services

1. In the Render dashboard, open the Node backend service.
2. Click **Manual Deploy → Deploy latest commit**.
3. Watch the deploy logs. Confirm there are no database connection errors.
4. Repeat for the `evolvee-partners` service.

---

## 8. Verify the migration

Perform the following checks after both services have deployed.

- [ ] Open the Operations Hub app. Log in.
- [ ] Confirm the Dashboard loads data correctly.
- [ ] Confirm at least one write operation works (for example, create a record and confirm it appears).
- [ ] Open the Supabase dashboard → Table Editor. Confirm the tables and rows are present.
- [ ] Open the `evolvee-partners` admin panel. Confirm data is present.

---

## 9. Remove the Render PostgreSQL service

Only delete the Render PostgreSQL service after you complete all checks in Section 8.

1. Go to the Render dashboard.
2. Open the PostgreSQL service.
3. Click **Settings → Delete Database**.
4. Confirm the deletion.

Keep `render-backup.dump` on your local machine for at least 30 days after the migration.

---

## Notes

- Supabase free tier does not delete databases. There is no 90-day expiry.
- The Supabase connection pooler port is `6543` (Transaction mode). The direct connection port is `5432`. Use the pooler port for both services.
- If a connection error occurs, check that `DATABASE_SSL=no-verify` is set on the Node backend. The backend will refuse an unverified TLS connection in production unless this variable is set.
