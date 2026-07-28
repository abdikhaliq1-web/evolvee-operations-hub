# Products & reorder thresholds

← [Back to user guide](README.md)

The link between the store and the operations tools. Each SKU here is connected to its
**manufacturer**, its **reorder threshold**, and its **unit cost** — three small settings that
drive a lot of what shows on the dashboard. Available to the Operations Manager, Developer, and
Admin roles.

---

## Add a product

In the **Add product** row, enter:

- **SKU** — or, for the live store, the Shopify **inventory item ID** (this store's variants
  have no SKUs, so stock matches on the item ID).
- **Name**.
- **Manufacturer** — who makes it.
- **Threshold** — the stock level that should trigger a reorder alert.
- **Unit cost** — what each unit costs you.

SKU and name are required; the rest are optional. Click **Add**.

---

## Edit inline

Everything is editable in the table itself:

- **Manufacturer** — change it from the dropdown on the row; it **saves immediately**.
- **Threshold** and **unit cost** — edit in place, then click **Save** on that row.
- **Sort** any column, or **search** to find a SKU fast.

Click a product to open its detail page — stock, sales, price, reviews, reorder history, and
production runs for that one SKU.

---

## Why these three settings matter

They reach beyond this page:

- **Threshold** — the automated stock check compares stock against it. Drop to or below it and
  a reorder alert fires, showing on the dashboard and the [Alerts](alerts.md) page.
- **Manufacturer** — how a low-stock item knows *who to reorder from*.
- **Unit cost** — the missing piece for margin. On the dashboard's Product performance table,
  **margin % only appears for SKUs that have a cost set here.** A product with no cost shows
  units and revenue but a blank margin — that's your cue to come back and fill it in.

---

## Bulk-syncing from Shopify

There's a "sync from Shopify" action that pulls products that have SKUs straight from the
store, creating or updating them in bulk. Products without a SKU are skipped (expected for this
store) and are added by hand with their inventory item ID instead.
