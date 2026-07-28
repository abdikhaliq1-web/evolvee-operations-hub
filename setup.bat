@echo off
REM One-time setup for a LIVE server: seeds a SINGLE admin user (no demo data).
REM For the demo/sample dataset instead, run setup-demo.bat.
REM Assumes Node, PostgreSQL, and the opshub database/role exist
REM (see _docs\setup-help\prerequisites.md and database-setup.md).

set "PARTNERS_OK="

echo === Backend ===
cd /d "%~dp0backend"
call npm install || goto :err
if not exist .env copy .env.example .env
echo Review backend\.env (DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD) before running setup if needed.
call npm run db:reset || goto :err
call npm run db:seed:admin || goto :err

echo === Frontend ===
cd /d "%~dp0frontend"
call npm install || goto :err

echo === QR partner app (evolvee-partners) ===
where py >nul 2>nul
if errorlevel 1 (
    echo Python launcher "py" was not found - skipping the QR partner app.
    echo Install Python 3.11+ from https://www.python.org/downloads/ and re-run
    echo this script. The hub still works without it: the partner tile stays on
    echo its bundled sample data.
    goto :done
)
cd /d "%~dp0evolvee-partners" || goto :err
if not exist venv\Scripts\python.exe (
    py -m venv venv || goto :err
)
venv\Scripts\python.exe -m pip install -r requirements.txt || goto :err
venv\Scripts\python.exe setup_env.py || goto :err
venv\Scripts\python.exe manage.py migrate --noinput || goto :err
set "PARTNERS_OK=1"

:done
echo.
echo Setup complete (admin user seeded). If you left ADMIN_PASSWORD blank, the
echo generated password was printed once above - save it now.
echo Run run-server.bat to start the servers.
if defined PARTNERS_OK (
    echo.
    echo QR partner app: create a Command Center staff login with
    echo     cd evolvee-partners ^&^& venv\Scripts\python.exe manage.py createsuperuser
    echo To pull live partner data into the hub's partner tile, set in backend\.env:
    echo     PARTNER_DASHBOARD_MODE=live
    echo     PARTNER_DASHBOARD_BASE_URL=https://your-partner-app-url
    echo The shared secret is already paired - copy OPS_HUB_API_KEY from
    echo evolvee-partners\.env into the deployed partner app's environment.
    echo Then verify the link with _docs\test-integrations.bat.
)
goto :eof

:err
echo.
echo Setup failed (exit %errorlevel%). See message above.
exit /b %errorlevel%
