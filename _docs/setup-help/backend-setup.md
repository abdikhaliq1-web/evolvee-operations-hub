# Step 4 — Set up and run the backend

← [Back to README](../../README.md)

Run all backend commands from the `backend` folder:

```powershell
cd path\to\operations-hub\backend
```

---

## 4.1 Install dependencies

```powershell
npm install
```

---

## 4.2 Create your .env file

Copy the example:

```powershell
Copy-Item .env.example .env
```

Open `.env`. For local dev the defaults work as-is if you used the password
`opshub_dev_password` in step 3. If you chose a different one, update it in `DATABASE_URL`:

```
DATABASE_URL=postgresql://opshub:opshub_dev_password@localhost:5432/operations_hub
```

Set `JWT_SECRET` to a long random string. It signs the login tokens. Any value that nobody
can guess is sufficient for local development.

The server refuses to start with a weak secret on a real deployment. A real deployment is
`NODE_ENV=production`, a remote database, or any integration in `live` mode. Make a strong
value with this command:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Leave the `*_MODE=sample` lines as they are for now. See
[Sample data vs live API mode](sample-vs-live.md).

### Security settings

Leave these three empty for local development. The defaults are correct.

| Variable | Default | Purpose |
|---|---|---|
| `TRUST_PROXY` | `1` in production, `0` elsewhere | How many proxies the server trusts for the client IP address. The rate limits use that address. |
| `CROSS_SITE_COOKIES` | `true` in production, `false` elsewhere | Set to `true` when the frontend and the API are on different sites. The session cookie then uses `SameSite=None; Secure`, which needs HTTPS. |
| `DATABASE_CA_CERT` | empty | The PEM certificate of the database CA. Necessary for a remote database in production. |

**Caution:** Do not set `CROSS_SITE_COOKIES=true` on an HTTP address. The browser refuses a
`Secure` cookie on HTTP, and nobody can sign in.

[security.md](../maintenance/security.md) explains each control.

---

## 4.3 Create the tables and seed data

```powershell
npm run db:schema; npm run db:seed
```

This applies the schema, then seeds demo data. You'll see confirmation messages. The seed
creates 5 users (one per role), 3 manufacturers, 8 products with reorder thresholds, and
some sample history.

The schema is idempotent and also runs on every backend start, so you can't end up with
missing tables. To wipe everything and start clean in development, run `npm run db:reset`
(drops and re-creates all tables), then `npm run db:seed`.

---

## 4.4 Start the backend

```powershell
npm start
```

You should see:

```
Operations Hub backend running on http://localhost:4000
Stock check scheduled with cron pattern "0 * * * *"
[stock-check] checked 8 SKUs, created 4 new alert(s)
```

The stock check runs once at startup and then hourly. Four sample SKUs sit below their
thresholds on purpose, so you get alerts right away.

Sanity check, in a second PowerShell window:

```powershell
curl.exe http://localhost:4000/api/health
```

You should get `{"status":"ok",...}`. Leave the backend running.

---

The whole thing in one line:
`npm install; Copy-Item .env.example .env; npm run db:schema; npm run db:seed; npm start`

Next: [Step 5 — Set up and run the frontend](frontend-setup.md)
