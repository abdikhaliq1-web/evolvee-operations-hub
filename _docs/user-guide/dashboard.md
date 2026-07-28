# Dashboard

← [Back to user guide](README.md)

The home screen — everything important about the business in one scroll. You only see the
tiles your role allows, so your dashboard may be shorter than a colleague's. Nothing here is
a separate data source; the summary cards at the top are derived from the tiles below.

---

## The KPI strip (top)

A row of at-a-glance cards: today's sales and orders, revenue this month, sales over the last
30 days, units sold, total value of stock on hand, how many SKUs are low, pending shipments,
and open reorder alerts.

**A card turns red when it needs attention** — low stock, a delivery exception, or an open
reorder alert. Which cards appear depends on your role.

---

## The tiles

**Reorder alerts** — anything that's dropped to or below its reorder threshold, with a link
straight to managing it. These come from the manufacturer tool. Work them on the
[Alerts](alerts.md) page.

**Stock levels** — live stock per SKU from Shopify, with low-stock items flagged. Sort by any
column; export to CSV.

**Product sales** — units moved over 30 days as a bar chart, with the best and slowest
sellers called out.

**Product performance** — the analytical table: for each SKU, units and revenue (30 days),
margin %, inventory turnover, and sell-through. Sort by **Revenue** to find top earners, or by
**Margin %** to find your most profitable lines (often not the same products). *Margin only
appears for SKUs that have a unit cost set* — see [products.md](products.md).

**Top customers** — ranked by lifetime spend, pulling segment info from the CRM alongside
Shopify sales. Also shows average order value, whether they're a returning customer, and their
favourite product. Expand a customer's row to see recent orders. This is a live snapshot each
time the page loads, not stored data.

**Revenue** — daily figures for the current month and a monthly trend over the year. Hover the
charts for exact values.

**Orders in transit** — delivery/fulfilment status from courier tracking. Anything with a
delivery problem is flagged at the top as an exception so it can't be missed.

**QR partner dashboard** — placeholder; in development.

---

## Reading it

- Scan the KPI strip for anything **red**.
- A red **low-stock** or **reorder-alert** card → go to [Alerts](alerts.md).
- A red **delivery** card → check the exceptions banner on Orders in transit.
- A **stale-data banner** at the very top means a live source failed its last sync — the data
  under it may be old. (Never happens in demo mode.)

Every table on this page sorts by clicking a column header and exports to CSV with its export
button — handy for sharing a snapshot.
