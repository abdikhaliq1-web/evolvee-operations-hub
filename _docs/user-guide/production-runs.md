# Production runs

← [Back to user guide](README.md)

Track what's actually being made, from order to arrival. Available to roles with the
manufacturer tool (Operations Manager, Developer, Admin). This is the same data you see in the
"Production runs" tile on a [supplier record](manufacturers.md) — just the full view.

---

## Start a run

Start a run against a **manufacturer** (required) and, usually, a **product**. Add a
**quantity** and an **expected date** if you know them. A new run defaults to the **ordered**
status.

---

## Move it through the stages

A run has five statuses. Update the status as the work progresses:

| Status | Meaning |
|---|---|
| **ordered** | Placed with the supplier, not started. |
| **in_production** | Being made. |
| **shipped** | On its way to you. |
| **received** | Arrived. |
| **cancelled** | Called off. |

**Marking a run `received` is what feeds each supplier's average production time** (on their
record). So keeping runs up to date isn't busywork — it's what makes the supplier metrics
accurate. You can also update the expected date, quantity, and notes as things change.

---

## Tips

- A quantity, if set, must be greater than zero.
- Cancelled and received runs drop out of a supplier's "active runs" count; ordered, in
  production, and shipped runs count as active.
- This page and the supplier record show the same runs — update from wherever's convenient.
