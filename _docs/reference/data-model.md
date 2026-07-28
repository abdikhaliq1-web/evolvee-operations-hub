# Data model

← [Back to reference](README.md) · schema source: `backend/db/schema.sql`

The PostgreSQL tables, how they relate, the enumerated values, and the invariants that aren't
obvious from the column list. The schema is applied idempotently by `db/applySchema.js`
(`CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`), so it's safe to re-run and new
columns land on existing databases — see
[maintenance/database-maintenance.md](../maintenance/database-maintenance.md).

---

## Relationships at a glance

```
users ─┬─< reorder_history.created_by
       ├─< communications.logged_by
       └─< audit_log.user_id

manufacturers ─┬─< manufacturer_contacts   (CASCADE)
               ├─< products.manufacturer_id (SET NULL)
               ├─< communications           (CASCADE)
               ├─< production_runs          (CASCADE)
               └─< reorder_history.manufacturer_id (SET NULL)

products ─┬─1─ reorder_thresholds  (one per product, CASCADE)
          ├─< reorder_alerts       (CASCADE)
          ├─< reorder_history      (CASCADE)
          └─< production_runs.product_id (SET NULL)

manufacturer_contacts ─< communications.contact_id (SET NULL)

sync_status   — standalone, one row per integration source
audit_log     — standalone, append-only
```

`<` means "has many"; `1` means one-to-one. Cascade behaviour in parentheses.

---

## Tables

### `users`
Accounts and auth. `role` ∈ `admin, developer, ops_manager, marketing, partner` (CHECK).
`is_active` gates sign-in. `token_version` is bumped on password change/reset to invalidate
previously issued JWTs (see the auth flow in
[architecture.md](../maintenance/architecture.md)). `password_hash` is bcrypt.

### `manufacturers`
Suppliers. Metrics fields (`lead_time_days`, `min_order_quantity`, `payment_terms`,
`quality_rating` 1–5) are nullable and user-entered. `avg_production_days` is **not stored** —
it's computed on read from received production runs.

### `manufacturer_contacts`
People at a manufacturer. `ON DELETE CASCADE` from `manufacturers`.

### `products`
SKUs. `sku` is UNIQUE. `shopify_inventory_item_id` is how stock matches for the live store
(which has no SKUs); it has a unique index (NULLs allowed, so SKU-only products are fine).
`manufacturer_id` is `SET NULL` on manufacturer delete. `unit_cost` NUMERIC(10,2), nullable —
its absence is why a product can show revenue but no margin.

### `reorder_thresholds`
One row per product (`product_id` UNIQUE, CASCADE). `threshold ≥ 0` (CHECK). The stock check
compares stock against this.

### `reorder_alerts`
Raised by the stock check. `status` ∈ `open, acknowledged, resolved` (CHECK), default `open`.
`resolved_at` set when resolved. **Invariant:** a partial unique index
(`idx_alerts_one_active` on `product_id WHERE status IN ('open','acknowledged')`) enforces **at
most one active alert per product** — this is what makes the stock check's
`INSERT … ON CONFLICT DO NOTHING` race-safe and stops duplicate alerts stacking.

### `reorder_history`
A log of orders actually placed with a supplier. `quantity_ordered > 0` (CHECK). `created_by`
→ users (SET NULL).

### `communications`
Per-manufacturer contact log. `channel` ∈ `email, phone, meeting, other` (CHECK), default
`email`. `logged_by` → users, `contact_id` → contact (both SET NULL). `summary` required.

### `production_runs`
What's being made. `status` ∈ `ordered, in_production, shipped, received, cancelled` (CHECK),
default `ordered`. `quantity` nullable but, if set, `> 0` (named CHECK constraint added
defensively). Marking `received` is what feeds a manufacturer's computed `avg_production_days`
(from `updated_at − created_at`).

### `sync_status`
One row per integration `source` (PRIMARY KEY). Columns: `mode`, `last_run_at`,
`last_success`, `ok`, `message`. Written by `recordSync()` on every integration attempt; read
by `/api/sync/status` and `/api/health`. `last_success` is preserved across failures so you can
see how stale the data is.

### `audit_log`
Append-only trail. `user_id` → users (SET NULL), plus denormalised `user_name`, an `action`,
`entity`/`entity_id`, and a JSONB `details`. Indexed by `created_at DESC`. Grows unbounded —
prune old rows if needed (nothing references them).

---

## Indexes worth knowing

| Index | Why it exists |
|---|---|
| `idx_products_shopify_iid` (unique) | Fast stock matching by inventory item id; NULLs allowed. |
| `idx_alerts_one_active` (partial unique) | **The one-active-alert-per-product invariant.** |
| `idx_alerts_status` | Filtering alerts by status. |
| `idx_comms_mfr`, `idx_runs_mfr`, `idx_history_product` | The per-manufacturer / per-product lookups the detail pages do. |
| `idx_audit_created` | Newest-first audit listing. |

---

## Migrations

There's no migration framework. The idempotent DDL in `schema.sql` **is** the migration story:
keep changes additive, pair every new column with an `ADD COLUMN IF NOT EXISTS`, and anything
destructive needs a hand-written one-off script and a backup first. Full guidance:
[maintenance/database-maintenance.md](../maintenance/database-maintenance.md).
