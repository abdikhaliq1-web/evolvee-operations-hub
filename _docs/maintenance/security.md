# Security controls

← [Back to maintenance guide](README.md)

This page lists the security controls in the Operations Hub. It tells you what each control
does, where the code is, and what you must set to keep the control effective.

Read [access-management.md](access-management.md) for day-to-day user administration. Read
[architecture.md](architecture.md) for the full request flow.

---

## Sessions

The server keeps the session token in a cookie. Page scripts cannot read the cookie.

| Cookie | Readable by scripts | Content |
|---|---|---|
| `opshub_token` | No (`HttpOnly`) | The signed JWT. |
| `opshub_csrf` | Yes | A random value for the CSRF check. |

The login response does not contain the token. The browser stores only the user name, the
role, the permissions, and the expiry time. If an attacker runs a script in the page, the
script cannot read the session token.

Code: `backend/src/middleware/session.js`.

### Cookie attributes

The server sets the cookie attributes from the deployment shape:

| Deployment | `SameSite` | `Secure` |
|---|---|---|
| Production (`CROSS_SITE_COOKIES=true`) | `None` | Yes |
| Local development | `Lax` | No |

The Netlify site and the Render API are different sites. A cross-site cookie must use
`SameSite=None`, and `SameSite=None` needs `Secure`. Both ends use HTTPS, so this is safe.

The local Vite server sends `/api` to the backend through a proxy. Everything is the same
origin, so the stricter `Lax` cookie works.

**Caution:** Do not set `CROSS_SITE_COOKIES=true` on an HTTP deployment. The browser
refuses a `Secure` cookie on HTTP, and no user can sign in.

### CSRF protection

A cross-site cookie travels with any request that another site makes. The server therefore
uses a double-submit check.

1. The client reads the `opshub_csrf` cookie.
2. The client sends the value in the `X-CSRF-Token` header.
3. The server compares the header against the cookie.

The check applies to `POST`, `PATCH`, `PUT`, and `DELETE`. The check does not apply to
`GET`, `HEAD`, and `OPTIONS`. A request that fails the check gets `403`.

Requests that use `Authorization: Bearer` do not need the header. A browser never adds that
header on its own, so a forged request cannot supply it.

### To sign out

`POST /api/auth/logout` increases the user's `token_version` and deletes both cookies. The
old token stops working immediately.

**Note:** Sign-out ends the sessions on all of that user's devices, not only the current
device.

---

## Passwords

`backend/src/middleware/passwordPolicy.js` holds the rules. The rules apply to new users,
to admin resets, and to self-service changes.

A password must obey all of these rules:

- The password has 12 characters or more.
- The password does not start with a common word, for example `password` or `qwerty`.
- The password uses 5 different characters or more.
- The password does not contain the part of the email address before the `@` sign.

The server stores a bcrypt hash. The server never stores the plain password. There is no
way to recover a password. An admin can only set a new one.

The demo seed still writes the password `radiance123`. The seed writes the hash directly, so
the seed does not obey the policy. The seed refuses to run against a remote database. See
[access-management.md](access-management.md).

---

## Rate limits

`backend/src/middleware/rateLimit.js` holds the limiter. Each rule counts requests against
one key. A request that breaks any rule gets `429`.

| Endpoint | Rule | Limit |
|---|---|---|
| `POST /api/auth/login` | IP and email together | 10 per 15 minutes |
| `POST /api/auth/login` | Email alone | 20 per 15 minutes |
| `POST /api/auth/login` | IP alone | 50 per 15 minutes |
| `POST /api/auth/password` | IP alone | 20 per 15 minutes |
| `POST /api/alerts/check-now` | User | 5 per minute |
| `POST /api/alerts/check-now` | All users together | 20 per minute |
| `POST /api/products/sync-shopify` | User | 5 per minute |
| `POST /api/products/sync-shopify` | All users together | 20 per minute |

The rule for the email alone is the important one. Without it, an attacker who changes IP
address gets an unlimited number of tries against one account.

The two Shopify endpoints call the store on each request. The limits stop one account from
using all of the store's API quota.

**Note:** The limiter keeps its counts in memory. Each server process counts separately, and
a restart clears the counts. Use a shared store if you run more than one process.

---

## Trusted proxies

The rate limits use the client IP address. `TRUST_PROXY` sets how many proxies the server
trusts.

| Value | Effect |
|---|---|
| `1` (default in production) | The server reads the client IP from `X-Forwarded-For`. |
| `0` (default elsewhere) | The server uses the socket address. |

Render puts one proxy in front of the service, so `1` is correct there.

**Caution:** Set `TRUST_PROXY=0` if the server accepts connections directly from the
internet. If the server trusts a proxy that does not exist, any client can put a false
address in `X-Forwarded-For` and get past the rate limits.

---

## Permissions

Two maps in `backend/src/middleware/auth.js` control access:

- `ROLE_PERMISSIONS` — the modules a role can **see**.
- `WRITE_PERMISSIONS` — the modules a role can **change**.

| Role | Can see | Can change |
|---|---|---|
| `admin` | All modules | `alerts`, `manufacturers`, `users`, `sync` |
| `developer` | All modules except `users` | `alerts`, `manufacturers`, `sync` |
| `ops_manager` | Operations modules and `manufacturers` | `alerts`, `manufacturers`, `sync` |
| `marketing` | `sales`, `customers`, `partners` | Nothing |
| `partner` | `partners` | Nothing |

To make a role read-only, delete the module from `WRITE_PERMISSIONS`. Keep the module in
`ROLE_PERMISSIONS`. The role then keeps access to the screen but gets `403` on each write.

The server refuses to start if a role can change a module that it cannot see. This stops a
configuration mistake that is otherwise difficult to find.

Each router applies `requireWrite()` one time. The check therefore covers every route on
that router, and it also covers each route that you add later.

### Restricted actions

Some actions need more than write access to the module:

| Action | Roles | Reason |
|---|---|---|
| `DELETE /api/alerts/:id` | `admin`, `developer` | The delete destroys the record that a stock problem happened. |

`ALERT_DELETE_ROLES` in `auth.js` holds the list. The server sends the list to the client,
so the client does not keep a second copy of the rule.

---

## Protection for admin actions

An admin must confirm the admin's own password to change another user's role, active state,
or password. Send the password in the `admin_password` field of the request body.

A stolen session is therefore not enough to take over an account. The attacker also needs
the admin's password.

Code: `reauthenticated()` in `backend/src/routes/users.js`.

---

## Audit trail

`backend/src/services/audit.js` writes to the `audit_log` table. The table records these
actions:

| Action | Recorded data |
|---|---|
| `login` | The user and the email address. |
| `login_failed` | The email address and the reason. |
| `password_change` | The user. |
| User create and update | The role change, the active-state change, and any password reset. |
| Alert delete | The product, the stock level, the threshold, and the status. |
| Manufacturer and product changes | The changed fields. |

The alert delete entry is important. The alert row is gone, so the audit entry is the only
record that the alert existed.

Read the log at `GET /api/audit`, or on the Team access page. The `users` permission
controls access.

---

## HTTP headers

The backend sets these headers on each response:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Strict-Transport-Security` | Set in production only. |

The API sends only JSON, so the policy can refuse every content type.

`netlify.toml` sets the headers for the frontend. The frontend policy allows scripts from
the site itself, and no other source:

```
script-src 'self'
```

The policy allows `'unsafe-inline'` for styles only, because the interface uses inline style
properties.

**Caution:** Do not add `'unsafe-inline'` to `script-src`. That change makes the policy
useless.

The `connect-src` rule lists the API origin. The default value matches the Render service.
Change the value to your exact backend URL.

The theme script is in `frontend/public/theme.js`. Keep the script in a file. An inline
script does not run under this policy.

---

## Database connection

The backend refuses to start in production if the database connection cannot verify the
server. Set `DATABASE_CA_CERT` to the PEM certificate of the database CA.

`DATABASE_SSL=no-verify` also starts the server. That value encrypts the connection but
does not verify the server.

**Caution:** `no-verify` leaves the connection open to a man-in-the-middle attack. Use
`DATABASE_CA_CERT` unless you cannot get the certificate.

---

## Behaviour after an error

An uncaught exception leaves the process in an unknown state. The server therefore writes
the error to the log and stops. The platform then starts a new process.

Code: `backend/src/server.js`.

The error handler in `backend/src/middleware/errorHandler.js` sends a general message for
each `5xx` error. The handler writes the full error to the server log. A client never sees a
stack trace.

`withSync()` in `backend/src/services/apiClient.js` changes each upstream failure to `502`.
A Shopify `401` therefore does not reach the browser, where it starts the sign-out
behaviour.

---

## Self-checks

Each security module contains a self-check. Run the checks from the `backend` folder:

```powershell
node src/middleware/auth.js
node src/middleware/session.js
node src/middleware/rateLimit.js
node src/middleware/passwordPolicy.js
```

Each command prints a "passed" message. A failure prints an assertion error and stops.

---

## What to do if a credential leaks

Do these steps in this order:

1. Make a new Shopify Admin API token. Put the new token in `SHOPIFY_ADMIN_TOKEN`.
2. Make a new Zoho client secret. The old refresh token stops working, so get consent again
   and put the new refresh token in `ZOHO_REFRESH_TOKEN`.
3. Make a new partner API key. Set the same value in both applications.
4. Make a new `JWT_SECRET`. This step signs out every user.

The command for a new secret is:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
