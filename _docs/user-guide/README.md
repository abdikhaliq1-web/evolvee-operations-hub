# User guide

← [Back to project README](../../README.md)

How to *use* the Operations Hub, screen by screen — written for the people who work in it
every day, not for installing or deploying it. If you need to get it running first, that's
the [setup guide](../setup-help/). There are also short [video walkthroughs](../deployment/video-scripts/)
that cover the same ground on screen.

The app is two tools behind one login: an **operations dashboard** (stock, sales, customers,
revenue, deliveries, alerts) and a **manufacturer & reorder tool** (suppliers, contacts,
thresholds, production runs). What you see depends on your role.

---

## Start here

1. [Signing in](../setup-help/logging-in.md) — where to log in and the demo accounts.
2. [Your account](account.md) — **change your password first**, and the "View as" preview.
3. The screen you need, below.

---

## The screens

| Screen (nav label) | What you do there | Guide |
|---|---|---|
| Dashboard | Read stock, sales, customers, revenue, deliveries, open alerts at a glance | [dashboard.md](dashboard.md) |
| Manufacturers & suppliers | Manage suppliers, contacts, communications, reorders | [manufacturers.md](manufacturers.md) |
| Products & reorder thresholds | Link SKUs to suppliers; set reorder thresholds and unit costs | [products.md](products.md) |
| Alerts | Work the reorder queue — acknowledge, resolve, run a check now | [alerts.md](alerts.md) |
| Production runs | Track what's being made, ordered → received | [production-runs.md](production-runs.md) |
| Team access (admin only) | Create users, set roles, deactivate accounts | [team-access.md](team-access.md) |
| Account | Change your own password | [account.md](account.md) |

---

## Roles — what each can do

Your role is set by an admin and decides which screens and data you can reach. It's enforced
on the server, so you can't see or pull data your role doesn't allow — hiding a menu item
isn't the only thing stopping you.

| Role | Can use |
|---|---|
| **Admin** | Everything, including Team access (user management). |
| **Developer** | Everything except Team access. |
| **Operations Manager** | Dashboard (inventory, sales, customers, revenue, shipping, alerts) + the manufacturer tool. The main day-to-day role. |
| **Marketing** | Sales, customers, and the partner module. |
| **Partner / Ambassador** | The partner module only. |

The **QR partner dashboard** is still in development — it currently shows a "coming soon"
placeholder.

---

## Two things everyone should know

- **Every table sorts and searches.** Click a column header to sort; type in the search box
  to filter. Most tables also have an **Export CSV** button for sharing a snapshot outside
  the app.
- **Stale-data honesty.** If a live data source (Shopify, the CRM, courier tracking) fails
  its most recent sync, a banner appears at the top naming the source, so old numbers are
  never shown as if they were current. In demo/sample mode everything reports healthy.
