# Monitoring & health

← [Back to maintenance guide](README.md)

How to tell, in under two minutes, whether the Operations Hub is healthy — and where to
look first when it isn't.

---

## The one endpoint to check

```
GET /api/health
```

- Local: <http://localhost:4000/api/health>
- Production: `https://<your-render-app>.onrender.com/api/health`

It returns JSON and an HTTP status:

| Response | Meaning |
|---|---|
| `200` with `{ ok: true, time: ... }` | App is up and the database is reachable. |
| `200` with `{ ok: true, degraded: true }` | App is up, but at least one source in `sync_status` last failed (`ok = false`). Data may be stale. Investigate the failing source. |
| `503` with `{ ok: false, db_ok: false }` | The database query failed. This is the serious one — the app can't read or write. |

No auth is needed, so you can hit it from a browser, a `curl`, or an uptime monitor.

**Wire it to an uptime monitor.** Point any external monitor (UptimeRobot, Render's own,
etc.) at `/api/health` and alert on non-`200`. That turns "a user told us it's down" into
"we knew first".

---

## The `sync_status` table — is the data fresh?

Every integration attempt writes a row here (via `recordSync` in `apiClient.js`):

| Column | Meaning |
|---|---|
| `source` | `shopify`, `zohoCrm`, … |
| `mode` | `sample`, `live`, or `off` at the time of the run |
| `last_run_at` | When it last tried |
| `last_success` | When it last succeeded (unchanged by a failure, so you can see how stale the data is) |
| `ok` | Did the most recent run succeed? |
| `message` | The error text when it didn't |

Two ways to read it:

- **In the app** — signed in with a role that has the `sync` module (admin, developer,
  ops_manager), call `GET /api/sync/status`. A failing live source also raises a
  sync-failure banner in the UI instead of silently serving stale data.
- **In the database** — straight query:

```powershell
psql $env:DATABASE_URL -c "SELECT source, mode, ok, last_run_at, last_success, message FROM sync_status ORDER BY source;"
```

A row where `ok = false` and `last_success` is hours old means that source has been down for
a while — go to [integrations.md](integrations.md).

---

## Reading the logs

The backend logs to stdout. In production, that's **Render → your service → Logs**. Locally,
it's the backend PowerShell window. Lines worth grepping for:

| Log line | What it means |
|---|---|
| `Operations Hub backend running on port 4000` | Clean start. |
| `Database schema ensured (tables present).` | Startup schema check passed. |
| `Stock check scheduled with cron pattern "0 * * * *"` | Cron registered. |
| `[stock-check] checked N SKUs, created M new alert(s)` | A stock check ran successfully. |
| `[stock-check] failed: ...` | A stock check threw — usually Shopify is unreachable or misconfigured. |
| `Schema check failed on startup: ...` | The DB was unreachable at boot. The server still binds (by design) but nothing will work until the DB is back. |
| `HTTP 4xx/5xx from <host>: ...` | An external API rejected a call. `401` = bad credentials; `429` = rate limited (the client already backs off and retries these). |
| `Unhandled promise rejection` / `Uncaught exception` | A bug slipped past error handling. Capture the stack and investigate. |

---

## The scheduled stock check

Runs at startup and then on `STOCK_CHECK_CRON` (default hourly, `0 * * * *`). Healthy
behaviour:

- A `[stock-check] checked …` line appears roughly every hour.
- Products at/below their reorder threshold produce `open` alerts on the Alerts page;
  duplicates never stack (one active alert per product, enforced by the database).

If you don't trust it, force a run without waiting for the hour: on the **Alerts** page,
click **Run check now**. In sample mode, 4 of the 8 SKUs are below threshold and should
produce alerts — a good smoke test that the whole chain works.

If checks aren't happening: confirm the process is actually running (health endpoint),
check the logs for `[stock-check] failed`, and confirm `STOCK_CHECK_CRON` is a valid cron
string (a malformed one silently schedules nothing).

---

## A 2-minute daily pass

1. `/api/health` → `200`, `ok: true`, no `degraded: true`.
2. Skim the last hour of logs for `failed`, `5xx`, or `Uncaught`.
3. If anything's off, open `sync_status` and read the `message` column.

Anything red → [integrations.md](integrations.md) for a data source,
[database-maintenance.md](database-maintenance.md) for the DB.
