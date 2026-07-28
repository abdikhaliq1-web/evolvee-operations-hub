# Access management

← [Back to maintenance guide](README.md)

Managing who can sign in and what they can see. Most of this is done in the app by an Admin —
no database access needed. The parts that touch the server (JWT secret, the permission map)
are here too.

---

## Roles and what they see

Five roles, defined once in `backend/src/middleware/auth.js` (`ROLE_PERMISSIONS`). That map
is the single source of truth — the frontend nav and the backend both read from it.

| Role | Sees |
|---|---|
| `admin` | Everything, **including user management**. |
| `developer` | Everything except user management. |
| `ops_manager` | Operations + manufacturer tool. **Revenue is included by default.** |
| `marketing` | Sales, customers, partner module. |
| `partner` | Partner module only. |

**The revenue toggle.** Revenue visibility for `ops_manager` is just the `'revenue'` entry in
that role's array in `auth.js`. Remove it to hide revenue from ops managers; add it to another
role to grant it. It's a code change (edit → redeploy), not a setting.

---

## Day-to-day user admin (in the app)

Sign in as an Admin → **Users** page. All of this is self-service:

- **Add a user** — email, full name, role, and an initial password (minimum 8 characters).
  Emails are stored lowercase; a duplicate email is rejected.
- **Change a role** — pick a different role. Takes effect on their next request.
- **Reset a password** — set a new one. **This immediately invalidates all of that user's
  existing sessions** (the server bumps their `token_version`), so any device they're signed
  in on is logged out and must sign in again with the new password.
- **Deactivate a user** — set them inactive. They can no longer sign in and existing sessions
  stop working. Reactivate the same way.

Two guardrails you'll hit by design, not by bug:

- You **cannot deactivate your own account.**
- You **cannot remove or deactivate the last active admin** — promote another admin first.
  This keeps the system from locking everyone out of user management.

---

## Passwords

- Hashed with bcrypt; the plaintext is never stored and can't be recovered — a "reset" always
  means setting a *new* password, never retrieving the old one.
- Minimum length is 8 characters, enforced on both create and reset.
- There's no self-service "forgot password" flow. A user who's locked out needs an Admin to
  reset their password on the Users page.

---

## Sessions and JWT

- Sign-in issues a JWT carrying the user's id and `token_version`; it expires after
  `JWT_EXPIRES_IN` (default `8h`). After that, the user signs in again — normal and expected.
- Every request re-checks the user against the database: inactive users and tokens issued
  before a password reset (stale `token_version`) are rejected even if the token hasn't
  expired yet. That's what makes "reset password → instantly logged out everywhere" work.

### Rotating `JWT_SECRET`

`JWT_SECRET` signs every token. Rotate it if you suspect it leaked.

- **Effect:** every existing token becomes invalid → **everyone is logged out at once** and
  must sign in again. No data is affected.
- **How:** set a new strong value on the server (Render env var) and redeploy. Generate one
  with:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- The server **refuses to start** with a weak or placeholder secret on any live/remote deploy
  (production, remote database, or any integration in `live` mode), so you can't accidentally
  ship a guessable one. See `backend/src/config/env.js`.

---

## The admin account itself

The first admin is created at deploy time by `admin` seed mode (`AUTO_SEED=admin` or
`npm run db:seed:admin`). If `ADMIN_PASSWORD` is left blank, a strong random password is
generated and printed **once** to the deploy logs — grab it then. After the first admin
exists, create the rest from the Users page. 

---

## The audit log

User and data actions are recorded in the `audit_log` table and readable by user-management
roles at `GET /api/audit` (latest 200). Use it to answer "who changed this and when." It grows
over time — pruning guidance is in [database-maintenance.md](database-maintenance.md).
