@echo off
REM Live connectivity tests for each external integration, using backend\.env.
REM Each service is SKIPped unless its *_MODE is set to live. See
REM integration-tests\README.md (next to this file).
REM The Evolvee Partners check needs that app running (run-server.bat starts it).
node "%~dp0integration-tests\run-all.cjs"
exit /b %errorlevel%
