# Common operational issues

← [Back to maintenance guide](README.md)

A runbook for things that break *after* the app is live and running. This is different from
[setup-help/troubleshooting.md](../setup-help/troubleshooting.md), which is about a fresh
install failing to start — go there for "node/psql not recognized", port conflicts, and
first-run database errors. This file assumes the app was working and something changed.

Each entry: symptom → likely cause → fix. When in doubt, start at
[monitoring-and-health.md](monitoring-and-health.md) and read the `sync_status` `message`
column — it usually names the problem.

---

## `/api/health` returns `degraded: true`

**Symptom:** app loads, but health reports `degraded`; a source shows a sync-failure banner.
**Cause:** a `live` integration's most recent run failed (`ok = false` in `sync_status`).
**Fix:** read that source's `message`, then go to [integrations.md](integrations.md).
Fastest triage: flip the source to `sample`. If `degraded` clears, it's the credential or the
upstream API, not the app.

---

## `/api/health` returns `503` / `db_ok: false`

**Symptom:** health is `503`; nothing in the app loads.
**Cause:** the backend can't reach PostgreSQL — DB down, wrong `DATABASE_URL`, or (on a
managed host) the database was paused/restarted.
**Fix:**
1. Is the database instance up? (Render dashboard, or `Get-Service postgresql*` locally.)
2. Does `DATABASE_URL` still point at it, with the right credentials?
3. On a remote host, confirm SSL isn't the blocker — it's auto-detected on for remote hosts;
   override with `DATABASE_SSL` only if the provider needs it explicitly.

The backend is built to keep running even if the DB is down at boot (it logs
`Schema check failed on startup` and still binds the port), so once the DB is back the app
recovers without a redeploy.

---

## Shopify or Zoho keeps failing with `401`

**Symptom:** one source persistently `ok = false`; logs show `HTTP 401 from <host>`.
**Cause:** revoked/expired credential. Retrying can't fix auth failures.
**Fix:** rotate the credential — Shopify Admin token, or Zoho refresh token. Full steps in
[integrations.md](integrations.md). Restart/redeploy after updating Zoho so the token cache
rebuilds.

---

## A source keeps failing with `429` or `5xx`

**Symptom:** intermittent failures, `HTTP 429/5xx` in logs.
**Cause:** upstream rate limiting or a transient outage.
**Fix:** usually none needed — the client already retries these with backoff and honours
`Retry-After`, so brief blips self-heal. If it's *sustained*, the upstream service is having
an incident; run that source in `sample` until it recovers so the app stays usable.

---

## Everyone got logged out at once

**Symptom:** all users forced to sign in again, simultaneously.
**Cause:** `JWT_SECRET` changed between issuing and verifying tokens — a rotation, or a
redeploy that changed the env var. Every existing token became invalid.
**Fix:** expected if you rotated it on purpose. If not, something reset the secret — set it
back to the intended value (or accept the rotation) and confirm it's stable across restarts.
See [access-management.md](access-management.md).

---

## One user is unexpectedly logged out / can't get in

**Symptom:** a single user, not everyone.
**Cause:** one of four things. The token expired, which is normal after `JWT_EXPIRES_IN`
(default 8h). Somebody reset the password, which ends that user's sessions. The user pressed
Sign out on another device, which also ends this session. Somebody deactivated the
account.
**Fix:** ask the person to sign in again. If that fails, an Admin opens the Team access page
and checks that the account is active and has the correct role. The Admin then resets the
password. The Admin must type their own password to confirm. See
[access-management.md](access-management.md).

---

## A user cannot change anything, but sees the screen

**Symptom:** the buttons and the forms are missing, or a write gets `403` with "has read-only
access to this module".
**Cause:** the role can see the module but cannot change it. This is correct behaviour.
**Fix:** if the person needs write access, add the module to that role in
`WRITE_PERMISSIONS` in `backend/src/middleware/auth.js`, then deploy again. See
[access-management.md](access-management.md).

---

## A user cannot delete an alert

**Symptom:** the Delete button is missing on the Alerts page for an Operations Manager.
**Cause:** only `admin` and `developer` can delete an alert. This is correct behaviour.
**Fix:** ask an Admin or a Developer to delete it. To acknowledge or resolve an alert is
enough for normal work.

---

## No reorder alerts are appearing

**Symptom:** Alerts page empty when you'd expect low-stock alerts.
**Cause:** the stock check isn't running, Shopify stock isn't reaching it, or nothing is
actually below threshold.
**Fix:**
1. Click **Run check now** on the Alerts page to force a run.
2. Check logs for `[stock-check] checked N SKUs …` (ran) vs `[stock-check] failed` (threw).
3. In `live` mode, confirm each product's `shopify_inventory_item_id` is set — the check
   matches stock by that id and silently skips products without it.
4. Confirm `STOCK_CHECK_CRON` is a valid cron string; a malformed one schedules nothing.

In `sample` mode, 4 of 8 SKUs are below threshold, so a forced run should always produce
alerts — a clean way to prove the chain works.

---

## The app is slow, or "too many clients" errors

**Symptom:** sluggish responses, or Postgres connection errors under load.
**Cause:** the connection pool is small and shared; either connections aren't being released,
or you're running more backend instances than the Postgres plan allows connections for.
**Fix:** check pool size (`config/db.js`) against the database plan's connection limit; scale
the plan or reduce instances. If a specific query is slow, check table sizes and indexes —
[database-maintenance.md](database-maintenance.md).

---

## First request after idle is very slow (production)

**Symptom:** the app "hangs" on the first hit after a quiet period, then is fine.
**Cause:** on free/low hosting tiers, the backend spins down when idle and cold-starts on the
next request. Not a bug.
**Fix:** expected on those tiers. If it's a problem, keep the service warm (an uptime monitor
pinging `/api/health`, which you [want anyway](monitoring-and-health.md)) or move to a tier
that doesn't sleep.

---

## Still stuck

- Reproduce against `sample` mode to rule the integrations in or out.
- Read the backend logs top to bottom around the failure — the first error is usually the
  real one; later ones are fallout.
- If it's a first-run/setup-shaped problem after all, cross-check
  [setup-help/troubleshooting.md](../setup-help/troubleshooting.md).
