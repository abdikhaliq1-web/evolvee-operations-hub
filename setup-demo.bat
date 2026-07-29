@echo off
REM One-time setup for SAMPLE mode: seeds the full demo dataset (5 role users,
REM manufacturers, products) for local/sandbox use. All demo passwords are radiance123.
REM For a live server with a single admin user instead, run setup.bat.
REM Assumes Node, PostgreSQL, and the opshub database/role exist
REM (see _docs\setup-help\prerequisites.md and database-setup.md).

set "PARTNERS_OK="

echo === Backend ===
cd /d "%~dp0backend"
call npm install || goto :err
if not exist .env copy .env.example .env
echo Review backend\.env (DATABASE_URL, JWT_SECRET) before running setup if needed.
call npm run db:schema || goto :err
call npm run db:seed || goto :err

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
venv\Scripts\python.exe setup_env.py --base-url http://127.0.0.1:8000 --mode live || goto :err
venv\Scripts\python.exe manage.py migrate --noinput || goto :err
venv\Scripts\python.exe manage.py seed_demo || goto :err
set "DJANGO_SUPERUSER_PASSWORD=radiance123"
venv\Scripts\python.exe manage.py createsuperuser --noinput --username admin@evolveeradiance.com --email admin@evolveeradiance.com >nul 2>&1
set "DJANGO_SUPERUSER_PASSWORD="
set "PARTNERS_OK=1"

:done
echo.
echo Setup complete (demo data seeded). Logins are in _docs\setup-help\logging-in.md
echo (all passwords: radiance123). Run run-server.bat to start all servers.
if defined PARTNERS_OK (
    echo.
    echo The QR partner app runs at http://127.0.0.1:8000 - Command Center staff
    echo login is admin@evolveeradiance.com / radiance123. backend\.env is set to
    echo PARTNER_DASHBOARD_MODE=live, so the hub's partner tile reads that app
    echo directly. Start it with run-server.bat, or the tile shows a sync error.
)
goto :eof

:err
echo.
echo Setup failed (exit %errorlevel%). See message above.
exit /b %errorlevel%
