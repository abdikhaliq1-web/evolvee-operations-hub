# Step 7 — Sample data vs live API mode

← [Back to README](../../README.md)

Each external source has its own mode switch in `backend/.env`, so you can go live one
integration at a time as credentials arrive:

```
SHOPIFY_MODE=sample          # sample | live
ZOHO_CRM_MODE=sample
```

The QR partner dashboard is currently a placeholder

Shopify drives sales, top customers, stock levels, revenue (daily/weekly/monthly), and shipping status (order fulfilment tracking).

In sample mode the backend serves bundled JSON (in `backend/src/services/sampleData/`),
so the whole UI works without any credentials.

---

## Switching a source to live

1. Fill in the credentials in `.env`. Every variable is listed in `.env.example` with
   inline comments (e.g. `SHOPIFY_STORE_DOMAIN` + `SHOPIFY_ADMIN_TOKEN`, or the Zoho
   `CLIENT_ID` / `CLIENT_SECRET` / `REFRESH_TOKEN` trio). The account owner provides them.
2. Change that source's `*_MODE` to `live`.
3. Confirm the credentials connect with the
   [integration connectivity tests](../integration-tests/README.md)
   (`_docs\test-integrations.bat`). Each live source reports PASS or a full error.
4. Restart the backend (`Ctrl+C`, then `npm start`).

If a live call fails, the dashboard shows a sync-failure banner instead of silently
serving stale data. Check the sync status indicator and the backend console.

---

## Notes

- Shopify's REST Admin API has been legacy since Oct 2024, but still works for internal
  custom apps.
- Zoho uses OAuth refresh tokens; the backend caches and refreshes access tokens for you.

---

Next: [Step 8 — Troubleshooting](troubleshooting.md)
