@echo off
start "Backend"  powershell -NoExit -Command "cd '%~dp0backend'; npm start"
start "Frontend" powershell -NoExit -Command "cd '%~dp0frontend'; npm run dev"
if exist "%~dp0evolvee-partners\venv\Scripts\python.exe" (
    start "QR partners" powershell -NoExit -Command "cd '%~dp0evolvee-partners'; .\venv\Scripts\python.exe manage.py runserver --skip-startup-prompt"
) else (
    echo QR partner app not set up, skipping. Run setup-demo.bat or setup.bat to add it.
    pause
)
