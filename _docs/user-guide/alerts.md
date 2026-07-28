# Alerts

← [Back to user guide](README.md)

The working queue for reorders. Every open alert is a product that's fallen to or below its
reorder threshold. Available to roles with the alerts module (Operations Manager, Developer,
Admin).

---

## The workflow

Each alert moves through three states:

1. **Open** — just fired; nobody's touched it yet.
2. **Acknowledged** — you press **Acknowledge** to say you've seen it and you're on it.
3. **Resolved** — you press **Resolve** once you've placed the reorder.

**Only one open alert exists per product at a time.** That's deliberate: resolving an alert is
what allows the *next* one to fire if stock stays low. So an alert you leave open forever blocks
future alerts for that product — work the queue down.

You can also delete an alert outright if it was raised in error.

---

## Run a check now

Alerts normally fire from the automated stock check, which runs at startup and **every hour**.
The **Run check now** (or "check now") button runs it immediately instead of waiting for the
next hour — useful right after a delivery lands and you want the alert to clear, or right after
you've set a new threshold.

---

## Where alerts come from

An alert is raised when the stock check finds a product's stock at or below the **threshold**
you set on the [Products](products.md) page. So:

- No alerts when you expect them? Check the thresholds are set, and that the product is linked
  correctly. In demo/sample mode, 4 of the 8 SKUs are below threshold, so a **Run check now**
  should always produce alerts.
- To reorder from the right supplier, make sure the product has a **manufacturer** assigned —
  that's the link from a low-stock item to who makes it.

Open alerts also surface on the [dashboard](dashboard.md) so they're visible without coming
here.
