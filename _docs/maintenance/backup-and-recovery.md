# Backup & recovery

← [Back to maintenance guide](README.md)

The disaster-recovery side of maintenance: proving a backup works before you need it, and
getting the app back up after something breaks. The backup/restore *commands* live in
[database-maintenance.md](database-maintenance.md); this file is the plan around them.

The rule of thumb: **the database is the only thing you can't rebuild.** The frontend and
backend are just the current git commit redeployed. So recovery is almost always "restore the
database, redeploy the code, point the two ends at each other."

---

## What can fail, and what it costs

| Failure | Data lost? | Recovery |
|---|---|---|
| Backend won't boot / bad deploy | No | Roll back the deploy (below). Data untouched. |
| Frontend broken | No | Roll back the Netlify deploy. |
| A live integration down (Shopify/Zoho) | No | Flip mode to `sample`; fix the credential. See [integrations.md](integrations.md). |
| Bad data written (bulk edit, buggy script) | Yes, partially | Restore from the most recent good backup. |
| Database instance lost | Yes, everything since last backup | Restore into a fresh Postgres instance. |

Only the bottom two need the database backup. That's why the [weekly "backup exists and is
recent" check](README.md) matters.

---

## The restore drill (do this once, before you need it)

A backup you've never restored is a guess. Once — ideally right after go-live — prove the
whole loop works against a throwaway database, not production:

1. Take a backup with `pg_dump` (see [database-maintenance.md](database-maintenance.md)).
2. Create an empty scratch database (local, or a temporary Render DB).
3. Restore the backup into it with `pg_restore`.
4. Point a local backend's `DATABASE_URL` at the scratch DB, start it, hit `/api/health`,
   and sign in.

If all four steps pass, your recovery plan is real. Redo the drill whenever the backup
tooling or hosting changes.

---

## Recovering the database

1. **Stop writes.** Take the backend offline (or into `sample` mode) so nothing writes to a
   database you're about to overwrite.
2. **Pick the backup.** Newest one that predates the corruption. Verify its contents with
   `pg_restore --list` first.
3. **Restore** into the target with `pg_restore --clean --if-exists` — triple-check
   `DATABASE_URL` points where you intend.
4. **Verify** — `/api/health` returns `ok: true`, sign in, spot-check a few records.
5. **Bring writes back** — restart the backend / restore live mode.

Full commands: [database-maintenance.md](database-maintenance.md).

---

## Rolling back a deploy

No data involved — this is just reverting code.

**Backend (Render):**
- Render Dashboard → your service → **Events / Deploys** → pick the last known-good deploy →
  **Redeploy**. Or push a revert commit; Render redeploys on push.
- A schema change ships in `schema.sql` and applies on boot. Rolling *back* code that removed
  a column is safe (the column stays); rolling back code that *added* a column is safe too
  (idempotent DDL). Rolling back across a **destructive** hand-written migration is not — that
  needs a database restore, not just a code rollback.

**Frontend (Netlify):**
- Netlify Dashboard → **Deploys** → pick the previous deploy → **Publish deploy**. Instant,
  no rebuild.

**Integration only:** if the "bad deploy" was really a live source failing, don't roll back
code — flip `SHOPIFY_MODE` / `ZOHO_CRM_MODE` to `sample` on Render and fix the credential.
See [going-live.md](../deployment/going-live.md).

---

## After any recovery

- `/api/health` → `200`, `ok: true`, no `degraded: true`.
- `sync_status` shows recent successes for the sources you expect live.
- Sign in and confirm the data looks right.
- Confirm `CORS_ORIGIN` (Render) and `VITE_API_BASE` (Netlify) still point at each other —
  a restore or redeploy can leave them mismatched.
