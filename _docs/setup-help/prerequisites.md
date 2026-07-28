# Step 2 — Install the prerequisites

← [Back to README](../../README.md)

You need Node.js and PostgreSQL, plus Python if you want the QR partner app
(`evolvee-partners`) that feeds the hub's partner dashboard tile.

---

## 2.1 Node.js (v24 LTS)

1. Download the LTS installer (.msi) for Windows from https://nodejs.org.
2. Run it and accept the defaults. You don't need the optional "Tools for Native Modules"
   checkbox.
3. Close and reopen PowerShell, then check the versions:

```powershell
node --version    # v24.x.x (v20+ also works)
npm --version
```

If `node` isn't recognized, see
[Troubleshooting → PATH issues](troubleshooting.md#node-or-psql-is-not-recognized).

---

## 2.2 PostgreSQL 16

1. Go to https://www.postgresql.org/download/windows/ and click Download the installer
   (the EDB installer).
2. Pick PostgreSQL 16.x for Windows x86-64.
3. Run the installer:
   - Leave the components ticked. You can untick Stack Builder; it isn't needed.
   - When it asks for a password for the `postgres` superuser, pick one and write it down.
     You'll need it once, in the next section.
   - Keep the default port, 5432.
   - Accept the default locale.
4. Check it in a new PowerShell window:

```powershell
psql --version
```

If `psql` isn't recognized, PostgreSQL's `bin` folder isn't on your PATH. See
[Troubleshooting](troubleshooting.md#node-or-psql-is-not-recognized).

---

## 2.3 Python 3.11+ (optional — QR partner app only)

Needed only for `evolvee-partners`, the Django app behind the hub's **Partners &
commissions** tile. Skip it and the setup scripts skip that app; the tile keeps
serving its bundled sample data.

1. Download Python 3.11 or newer from https://www.python.org/downloads/.
2. Tick **Add python.exe to PATH** in the installer, and keep the **py launcher**
   option (the setup scripts look for `py`).
3. Check it in a new PowerShell window:

```powershell
py --version
```

The setup scripts create the virtual environment and install the requirements
for you — you don't need to do that by hand.

---

Next: [Step 3 — Set up the database](database-setup.md)
