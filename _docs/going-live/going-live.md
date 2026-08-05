# Going live on Render + Netlify

How to switch the already-deployed hosted app from bundled sample data to real API data.
This is the production version of [sample-vs-live.md](../setup-help/sample-vs-live.md).
Instead of editing a local `.env`, you set environment variables on the Render service.

> First time deploying? Do [Step 8 — Deploying](deployment.md) first.
> Come back here once the Render service and Netlify site are both live on sample data.

Each integration has its own switch, so you can go live one source at a time as
credentials arrive. Netlify serves the same frontend build either way; nearly all the work
is on Render.

---

## 1. Add credentials and flip the mode on Render

Render Dashboard → your `operations-hub-api` service → Environment. Add the variables for
the source you're enabling, then set its `*_MODE` to `live`.

| Source | Set mode | Credential variables to add |
|--------|----------|------------------------------|
| Shopify | `SHOPIFY_MODE=live` | `SHOPIFY_STORE_DOMAIN` (e.g. `your-store.myshopify.com`), `SHOPIFY_ADMIN_TOKEN` (`shpat_…`), `SHOPIFY_API_VERSION` (e.g. `2025-04`) |
| Zoho CRM | `ZOHO_CRM_MODE=live` | `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (the defaults for `ZOHO_ACCOUNTS_BASE` / `ZOHO_API_BASE` are fine) |

Credentials come from the account owner. Variable names and inline notes are all in
[backend/.env.example](../../backend/.env.example).

Saving an environment change on Render redeploys the service automatically, no manual
restart. Leave any source you don't have credentials for on `sample` / `placeholder`; the
rest still work.

---

## 2. Verify it connected

- Open the app and check the sync status indicator. A failed live call shows a
  sync-failure banner instead of silently serving stale data; the message names the source
  and error.
- Backend health: `https://<your-render-app>.onrender.com/api/health` returns `{ ok: true }`.
- Watch Render → Logs during the redeploy for integration errors on first boot (the stock
  check runs on startup).

---

## 3. Netlify side

Usually nothing changes. The live switch is entirely backend. Just confirm once that the
two ends still point at each other:

- Netlify env var `VITE_API_BASE` = your Render backend URL, no trailing slash.
- Render env var `CORS_ORIGIN` = your Netlify site URL.

If you only changed `*_MODE` and credentials, you don't need to redeploy Netlify.

---

## 4. Rolling back

Set the source's `*_MODE` back to `sample` (or `placeholder` for QR) on Render and save.
It redeploys to bundled data. Credentials can stay set; the mode switch controls live vs
sample.

---

## Shopify-specific note

This store's variants have no SKUs, so stock levels are matched on Shopify's
`inventory_item_id`. For reorder thresholds and low-stock alerts to fire against live data,
each DB product needs its `shopify_inventory_item_id` set (or the inventory item id entered
as the product's SKU). See the Products & reorder thresholds page. Sales tiles key on
product title in live mode, since order line items also carry no SKU.

## Don't forget (from the deploy checklist)

- Set `AUTO_SEED` to `false` after the first deploy seeded the admin user.
- Free Render Postgres expires 30 days after creation. Move both resources to a paid `plan`
  in [render.yaml](../../render.yaml) before relying on live data.