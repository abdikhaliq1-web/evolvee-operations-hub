# Team access (user management)

← [Back to user guide](README.md)

Where accounts and roles live. **Admin only** — it's the "Team access" item in the navigation,
and it doesn't appear for anyone else. This is the same screen the code calls the Users page.

---

## Create a user

Add an account with an email, full name, an initial password (at least 8 characters), and a
**role**. The role decides everything the person can see and do — there's no per-screen
permission tweaking. Roles:

| Role | Can use |
|---|---|
| Admin | Everything, including this page. |
| Developer | Everything except this page. |
| Operations Manager | Dashboard + the manufacturer tool. |
| Marketing | Sales, customers, partner module. |
| Partner / Ambassador | Partner module only. |

Emails are stored lowercase; a duplicate email is rejected.

---

## Change a role, reset a password, deactivate

- **Change role** — pick a different role; it takes effect on the person's next action.
- **Reset password** — set a new one. This **immediately signs that person out everywhere**
  (any device they were logged in on) and they must sign in again with the new password.
- **Deactivate** — blocks sign-in without deleting any of the history tied to the account.
  Reactivate the same way.

### Two guardrails

You'll hit these by design, not by bug:

- You **can't deactivate your own account.**
- You **can't remove or deactivate the last active admin** — promote another admin first, so
  the system can never lock everyone out of user management.

---

## Audit log

User and data actions are recorded and viewable here (latest entries), so you can answer "who
changed this, and when."

---

## For the whole team

- Everyone should [change their own password](account.md) the first time they sign in —
  especially away from the shared demo password.
- Deactivate leavers rather than deleting them, to keep their history intact.

Server-side details (sessions, JWT, rotating the signing secret) are in the maintenance docs:
[access-management.md](../maintenance/access-management.md).
