# Access management

← [Back to maintenance guide](README.md)

Who can sign in, what they can see, and what they can change. An Admin does most of this in
the application. No database access is necessary. The parts that touch the server, such as
the JWT secret and the permission maps, are also here.

For the other security controls, read [security.md](security.md).

---

## Roles, what they see, and what they can change

There are five roles. `backend/src/middleware/auth.js` holds two maps for them:

- `ROLE_PERMISSIONS` — the modules a role can **see**.
- `WRITE_PERMISSIONS` — the modules a role can **change**.

The frontend and the backend both read these maps. To see a module is not the same as to
change it.

| Role | Sees | Can change |
|---|---|---|
| `admin` | Everything, **including user management**. | `alerts`, `manufacturers`, `users`, `sync` |
| `developer` | Everything except user management. | `alerts`, `manufacturers`, `sync` |
| `ops_manager` | Operations and the manufacturer tool. **Revenue is included by default.** | `alerts`, `manufacturers`, `sync` |
| `marketing` | Sales, customers, partner module. | Nothing. |
| `partner` | Partner module only. | Nothing. |

These values keep the earlier behaviour. Each role that could write before can still write.

**To make a role read-only.** Delete the module from `WRITE_PERMISSIONS`. Keep the module in
`ROLE_PERMISSIONS`. The role then keeps the screen, but each change gets `403`. The interface
also hides the forms and the buttons for that role.

**The revenue toggle.** Revenue for `ops_manager` is the `'revenue'` entry in that role's
array in `ROLE_PERMISSIONS`. Delete the entry to hide revenue. Add the entry to another role
to show it. This is a code change, not a setting. Edit the file and deploy again.

**Restricted actions.** Some actions need more than write access. Only `admin` and
`developer` can delete an alert. `ALERT_DELETE_ROLES` in `auth.js` holds that list.

The server refuses to start if a role can change a module that it cannot see.

---

## Day-to-day user admin (in the app)

Sign in as an Admin → **Users** page. All of this is self-service:

- **To add a user** — give the email address, the full name, the role, and a first password.
  The password must obey the password policy below. The server stores the email address in
  lower case, and refuses a duplicate.
- **To change a role** — select a different role. The change applies at the person's next
  request.
- **To reset a password** — set a new one. **This ends all of that user's sessions
  immediately.** The server increases their `token_version`. Each device is then signed out,
  and the user must sign in again with the new password.
- **To deactivate a user** — set the user inactive. The user cannot sign in, and the existing
  sessions stop. Use the same control to activate the user again.

**Confirm your own password.** To change a role, an active state, or a password, you must
also type your own password in the field at the top of the user list. A stolen session is
therefore not enough to take over an account. The interface sends the value as
`admin_password`, and the server compares it against your own hash.

Two guardrails you'll hit by design, not by bug:

- You **cannot deactivate your own account.**
- You **cannot remove or deactivate the last active admin** — promote another admin first.
  This keeps the system from locking everyone out of user management.

---

## Passwords

`backend/src/middleware/passwordPolicy.js` holds the rules. A password must obey all of
these rules:

- The password has 12 characters or more.
- The password does not start with a common word, for example `password` or `qwerty`.
- The password uses 5 different characters or more.
- The password does not contain the part of the email address before the `@` sign.

The rules apply to new users, to admin resets, and to self-service changes.

The server keeps a bcrypt hash. The server never keeps the plain password, and cannot
recover it. A reset therefore always sets a **new** password.

There is no self-service "forgot password" function. An Admin must reset the password on the
Team access page.

---

## Sessions

- Sign-in makes a JWT that holds the user id and the `token_version`. The token expires after
  `JWT_EXPIRES_IN`. The default is `8h`. The user then signs in again. This is normal.
- The server sends the token in an `HttpOnly` cookie. Page scripts cannot read the cookie, so
  an injected script cannot steal the session. See [security.md](security.md).
- Each request checks the user against the database again. The server refuses an inactive
  user. The server also refuses a token that has an old `token_version`, even if the token
  has not expired. This makes "reset the password, and the user signs out everywhere" work.
- Sign-out calls `POST /api/auth/logout`. The server deletes the cookie and increases
  `token_version`. A copied token stops working immediately.

**Note:** Sign-out ends the user's sessions on all devices, not only on the current
device.

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

The `audit_log` table records user actions and data actions. Roles with the `users` module
read the log at `GET /api/audit`, which gives the most recent 200 entries. Use the log to
find who made a change, and when.

The log records these security actions:

- Each successful sign-in, and each failed sign-in with the reason.
- Each password change.
- Each user create and update, with the role change and the active-state change.
- Each alert delete, with the state of the alert before the delete.

The table becomes large with time. [database-maintenance.md](database-maintenance.md) tells
you how to remove old rows.
