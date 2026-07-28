# Developer reference

← [Back to project README](../../README.md)

The precise, source-of-truth technical docs — the API contract, the data model, the frontend
internals, and the development workflow. For the *narrative* overview (how the pieces fit, how
a request flows), start with [maintenance/architecture.md](../maintenance/architecture.md);
come here for the exact details.

| Doc | What it answers |
|---|---|
| [api.md](api.md) | Every endpoint: method, path, permission, body, response, error codes. |
| [data-model.md](data-model.md) | Tables, relationships, enums, indexes, and the invariants. |
| [frontend.md](frontend.md) | React routing, auth/session, the client permission model, shared helpers. |
| [development.md](development.md) | Running it, tests, branch workflow, conventions, invariants. |

## New here?

1. [README](../../README.md) + [setup-help/](../setup-help/) — get it running on demo data.
2. [maintenance/architecture.md](../maintenance/architecture.md) — the mental model.
3. This folder — the details for whatever you're touching.
4. [onboarding-and-growth-plan.md](../deployment/onboarding-and-growth-plan.md) — where the
   project is headed and who owns what.

Keep these in sync with the code: if you change a route, a table, or a convention, update the
matching doc in the same PR.
