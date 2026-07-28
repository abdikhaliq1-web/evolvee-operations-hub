# Maintenance guide

← [Back to project README](../../README.md)

For whoever keeps the Operations Hub running after it's live. Setup and first-run
problems live in [`setup-help/`](../setup-help/); switching to real data lives in
[`deployment/`](../deployment/). This folder is about the day-to-day: is it healthy,
what do I do when a sync fails, how do I back up the database, how do I add a user.

If something is broken *right now*, jump to the file for that area below. If you're new
to the codebase, read [architecture.md](architecture.md) first, then the precise contracts in
[../reference/](../reference/) (API, data model, frontend). End-user "how do I use this screen"
questions live in the [../user-guide/](../user-guide/).

---

## Files in this folder

- **[architecture.md](architecture.md)** — how the pieces fit together, where each concern
  lives, how a request and a data sync actually flow. Read this before changing code.
- **[monitoring-and-health.md](monitoring-and-health.md)** — what "healthy" looks like, the
  `/api/health` endpoint, the `sync_status` table, reading logs, the node-cron stock check.
- **[database-maintenance.md](database-maintenance.md)** — backups, restore, schema changes,
  the destructive-reset guardrail, routine Postgres upkeep.
- **[integrations.md](integrations.md)** — Shopify and Zoho upkeep: modes, token expiry and
  rotation, rate limits, and exactly what breaks when a credential lapses.
- **[backup-and-recovery.md](backup-and-recovery.md)** — the restore drill, database recovery
  steps, and rolling back a Render/Netlify deploy.
- **[updating-dependencies.md](updating-dependencies.md)** — patching npm deps, deliberate
  upgrades, verifying with the tests, and bumping Node/Postgres.
- **[access-management.md](access-management.md)** — roles, adding/resetting users, sessions,
  and rotating `JWT_SECRET`.
- **[common-issues.md](common-issues.md)** — operational failure runbook (symptom → cause →
  fix), distinct from the setup-focused
  [troubleshooting.md](../setup-help/troubleshooting.md).
