# Integration maintenance

← [Back to maintenance guide](README.md)

The app pulls live data from two external services: **Shopify** (stock, sales, customers,
fulfilments) and **Zoho CRM** (customers). This is the upkeep that keeps them working —
mostly credential and token management, plus knowing what a failure looks like.

Per-API request details live in [`../api-notes/`](../api-notes/); this file is about keeping
them running, not first-time setup (that's [deployment/going-live.md](../deployment/going-live.md)).

---

## Modes: sample, live, off

Each source has an independent mode, set by an environment variable:

| Source | Variable | Values |
|---|---|---|
| Shopify | `SHOPIFY_MODE` | `sample`, `live`, `off` |
| Zoho CRM | `ZOHO_CRM_MODE` | `sample`, `live`, `off` |

- **sample** — bundled JSON from `services/sampleData/`. No credentials, always works. Good
  for demos and for isolating whether a problem is the integration or the app itself.
- **live** — real API calls with real credentials.
- **off** — the source returns empty data and reports success.

Changing a mode in production means editing the env var on Render (which redeploys) — see
[going-live.md](../deployment/going-live.md). **First move when a live source misbehaves:**
flip it to `sample`. If the app goes healthy, the problem is the credential or the upstream
API, not your code.

---

## What a failure looks like

You don't have to guess — the system surfaces it:

- The [`/api/health`](monitoring-and-health.md) endpoint reports `degraded: true`.
- The `sync_status` row for the source has `ok = false` and an error in `message`.
- The app shows a sync-failure banner naming the source, instead of silently showing stale
  data.
- The logs show `HTTP <status> from <host>: <body>`.

The retry/backoff for transient failures (`429`, `500`, `502`, `503`, `504`, timeouts,
network blips) is automatic inside `apiClient.js` — it retries a few times with backoff and
honours a `Retry-After` header. So a single blip self-heals. A *persistent* failure is
almost always a credential problem, which retrying can't fix.

Note: whatever the upstream status, the backend reports it to the browser as `502`, never
the raw code. A raw `401` would trip the frontend's logout interceptor. So "the data source
is down" never logs the user out — that's intentional.

---

## Shopify

**Credentials** (`backend/.env` locally, Render env vars in production):

- `SHOPIFY_STORE_DOMAIN` — e.g. `your-store.myshopify.com`
- `SHOPIFY_ADMIN_TOKEN` — the Admin API access token, starts with `shpat_`
- `SHOPIFY_API_VERSION` — e.g. `2025-04`

**Upkeep:**

- **Admin token.** If Shopify starts returning `401`, the token was revoked or rotated.
  Generate a new Admin API token in the Shopify admin (Settings → Apps and sales channels →
  Develop apps → your app → API credentials) and update `SHOPIFY_ADMIN_TOKEN`. Keep the
  app's scopes the same.
- **API version.** Shopify versions expire on a rolling ~12-month cycle. Before the version
  in `SHOPIFY_API_VERSION` is retired, bump it to a current one and confirm the calls still
  work in sample-then-live. Calls against a retired version fail.
- **Stock matching.** The live store has no SKUs, so stock is matched on Shopify's
  `inventory_item_id` (stored in `products.shopify_inventory_item_id`). If stock levels look
  wrong for a product, check that its `shopify_inventory_item_id` is set and correct — a
  missing id means the stock check silently skips that product.

See [api-notes/shopify.md](../api-notes/shopify.md) for endpoint specifics.

---

## Zoho CRM

**Credentials:**

- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` — the OAuth app's credentials
- `ZOHO_REFRESH_TOKEN` — the long-lived refresh token
- `ZOHO_ACCOUNTS_BASE` / `ZOHO_API_BASE` — **must match the account's data centre**
  (US = `.com`, EU = `.eu`, etc.). A region mismatch fails auth even with correct
  credentials.

**How the token flow works:** the app doesn't store an access token in config. It uses the
refresh token to fetch a short-lived access token (`zohoAuth.js`), caches it in memory, and
reuses it until ~1 minute before expiry. On restart the cache is empty and it fetches a fresh
one on first use. There's nothing to rotate hourly — that's automatic.

**Upkeep:**

- **The refresh token is the thing that lapses.** Zoho refresh tokens can be revoked, hit a
  per-account limit, or be invalidated if the OAuth app's scopes/secret change. When that
  happens you'll see `Zoho token refresh failed — check ZOHO_* values in .env` in the logs
  and a failing `zohoCrm` sync. Fix: generate a new refresh token in the Zoho API console and
  update `ZOHO_REFRESH_TOKEN`, then restart/redeploy so the token cache is rebuilt.
- **Data-centre moves.** If the Zoho account is migrated between regions, update both
  `ZOHO_ACCOUNTS_BASE` and `ZOHO_API_BASE` to the new region's domains.
- **Early rejection.** If the CRM rejects a still-cached token with a `401` (rotated early),
  `clearZohoToken()` exists to drop the cache and force a fresh fetch. A restart does the same.

See [api-notes/zoho-auth.md](../api-notes/zoho-auth.md) and
[api-notes/zoho-crm.md](../api-notes/zoho-crm.md) for the OAuth setup and endpoint details.

---

## A credential-check routine (monthly)

1. Note where each credential comes from and whether it has an expiry (Shopify API version
   has a known retirement date; Zoho refresh token can be revoked out from under you).
2. Confirm both sources show `ok = true` and a recent `last_success` in `sync_status`.
3. When you rotate any credential, do it during a quiet window, update the env var, redeploy,
   then re-check `sync_status`.

---

## Placeholders

The **QR partner dashboard** and any **Klaviyo** wiring are placeholders right now — no live
integration to maintain. When they go live, add their credential/upkeep notes here alongside
Shopify and Zoho, and their config to `.env.example`.
