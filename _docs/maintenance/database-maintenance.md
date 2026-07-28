# Database maintenance

← [Back to maintenance guide](README.md)

The PostgreSQL database is the only stateful part of the system — the frontend and backend
can be rebuilt from source at any time, but the database holds everything that matters
(users, manufacturers, products, thresholds, alerts, history). Treat it accordingly.

All commands are PowerShell. `$env:DATABASE_URL` is the connection string from
`backend/.env` (local) or the Render Postgres "External Database URL" (production).

---

## Backups

**This is the one thing you cannot skip.** Everything else here is recoverable from git.

### Production (Render Postgres)

Render takes automatic daily backups on paid plans — confirm they're enabled and note the
retention window in the Render dashboard. That covers most cases. For a manual snapshot
before anything risky (a schema change, a bulk edit):

```powershell
pg_dump $env:DATABASE_URL --format=custom --file="opshub-backup-2026-07-21.dump"
```

Use the custom format (`--format=custom`); it restores with `pg_restore` and is smaller.
Keep a couple of these somewhere off the server before any migration.

### Verify a backup is real

A backup you've never restored is a guess. List its contents without touching any database:

```powershell
pg_restore --list "opshub-backup-2026-07-21.dump"
```

You should see all the tables (`users`, `manufacturers`, `products`, `reorder_alerts`, …).

---

## Restore

Restoring **overwrites** the target database. Be certain which database `$env:DATABASE_URL`
points at before you run this — restoring a backup over live production is how you lose a
day of work.

```powershell
pg_restore --clean --if-exists --no-owner --dbname=$env:DATABASE_URL "opshub-backup-2026-07-21.dump"
```

- `--clean --if-exists` drops existing objects first so the restore isn't blocked by them.
- `--no-owner` avoids role-ownership mismatches between machines.

After restoring, hit [`/api/health`](monitoring-and-health.md) and sign in to confirm.

---

## Schema and structure

The schema lives in `backend/db/schema.sql` and is applied by `db/applySchema.js`, which is
**idempotent** — it uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`, so
running it against an existing database only adds what's missing and never drops data.

```powershell
cd backend
npm run db:schema     # safe to run any time; only creates what's missing
```

The server also runs this automatically at startup (`ensureSchema`), so a deploy with a new
column in `schema.sql` applies it on boot.

### Making a schema change

1. Edit `backend/db/schema.sql`. For a new column, add both the `CREATE TABLE` definition
   **and** an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` line, so existing databases pick it
   up. That's the pattern already used for `token_version`, `unit_cost`, etc.
2. Take a backup (see above).
3. Apply with `npm run db:schema`, or just deploy — startup applies it.

This project has no migration framework; the idempotent-DDL pattern is the migration story.
Keep changes additive. Anything destructive (dropping/renaming a column) needs a hand-written
one-off script and a backup first.

---

## The destructive commands — know what they do

| Command | Effect |
|---|---|
| `npm run db:schema` | Safe. Adds missing tables/columns. Never drops data. |
| `npm run db:seed` | Seeds the full demo dataset — **only if the database is empty**. The guard prevents duplicates. |
| `npm run db:seed:admin` | Seeds a single admin user — only if empty. |
| `npm run db:reset` | **DESTRUCTIVE.** Drops all tables and recreates them. Everything is deleted. Development only. |

`db:reset` against a database with real data is unrecoverable without a backup. There is no
confirmation prompt. Never run it against production.

To wipe and reseed a *development* database:

```powershell
cd backend
npm run db:reset
npm run db:seed
```

---

## Routine upkeep

For the size this app runs at, PostgreSQL's autovacuum handles maintenance on its own and
there's nothing to schedule. If the database grows large or feels slow:

- Check table sizes:
  ```powershell
  psql $env:DATABASE_URL -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
  ```
- `audit_log` is the table that grows without bound (one row per tracked action). If it gets
  large, archive or delete old rows — nothing depends on old audit entries:
  ```powershell
  psql $env:DATABASE_URL -c "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '1 year';"
  ```
- The connection pool is small and shared (`config/db.js`). "Too many clients" errors mean
  something isn't releasing connections, or you're running many backend instances against a
  small Postgres plan — check the pool size against the plan's connection limit.

---

## Connection quick reference

```powershell
# Open a psql session against whatever DATABASE_URL points at
psql $env:DATABASE_URL

# One-off query
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

Local default (from `.env.example`):
`postgresql://opshub:opshub_dev_password@localhost:5432/operations_hub`. SSL is auto-detected
— off for localhost, on for any remote host — so you rarely set `DATABASE_SSL` by hand.
