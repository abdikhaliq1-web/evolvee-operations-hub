# Team access (user management)

← [Back to user guide](README.md)

Where accounts and roles live. **Admin only** — it's the "Team access" item in the navigation,
and it doesn't appear for anyone else. This is the same screen the code calls the Users page.

---

## Create a user

Add an account with an email address, a full name, a first password, and a **role**. The
role decides what the person can see and what the person can change.

A password must obey all of these rules:

- The password has 12 characters or more.
- The password does not start with a common word, for example `password` or `qwerty`.
- The password uses 5 different characters or more.
- The password does not contain the part of your email address before the `@` sign.

Roles:

| Role | Can see | Can change |
|---|---|---|
| Admin | Everything, including this page. | Alerts, manufacturers, products, users. |
| Developer | Everything except this page. | Alerts, manufacturers, products. |
| Operations Manager | Dashboard and the manufacturer tool. | Alerts, manufacturers, products. |
| Marketing | Sales, customers, partner module. | Nothing. |
| Partner / Ambassador | Partner module only. | Nothing. |

To see a screen is not the same as to change it. Marketing and Partner users see their
screens without the buttons and the forms.

The server stores each email address in lower case, and refuses a duplicate.

---

## Change a role, reset a password, deactivate

**First, type your own password** in the field above the list. The three actions below all
need it. This makes sure that a stolen session alone cannot take over an account.

- **To change a role** — select a different role. It applies at the person's next action.
- **To reset a password** — set a new one. This **signs that person out everywhere
  immediately**, on each device. The person must sign in again with the new password.
- **To deactivate** — stop the sign-in without a delete. All history stays. Use the same
  control to activate the account again.

### Two guardrails

You'll hit these by design, not by bug:

- You **can't deactivate your own account.**
- You **can't remove or deactivate the last active admin** — promote another admin first, so
  the system can never lock everyone out of user management.

---

## Audit log

The log records user actions and data actions, so you can find who made a change, and when.
You read the most recent entries here.

The log also records each sign-in, each failed sign-in, each password change, each role
change, and each deleted alert.

---

## For the whole team

- Each person must [change the password](account.md) at the first sign-in. This is important
  if you still use the shared demo password.
- Deactivate a person who leaves. Do not delete the account, because the history stays with
  the account.

Server-side details (sessions, JWT, rotating the signing secret) are in the maintenance docs:
[access-management.md](../maintenance/access-management.md).
