@echo off
setlocal
pushd "%~dp0" || exit /b 1
powershell.exe -NoProfile -Command "$node = Get-Command node -ErrorAction SilentlyContinue; $candidates = @(); if ($node) { $bundle = Split-Path (Split-Path (Split-Path $node.Source)); $bundledPython = Join-Path $bundle 'python/python.exe'; if (Test-Path -LiteralPath $bundledPython) { $candidates += $bundledPython } }; $candidates += 'python'; foreach ($python in $candidates) { try { & $python -c 'import openpyxl' 2>$null; if ($LASTEXITCODE -ne 0) { continue } } catch { continue }; & $python -B server.py; exit $LASTEXITCODE }; Write-Error 'Install Python, then run: python -m pip install -r requirements.txt'; exit 1"
set "launchStatus=%errorlevel%"
popd
if not "%launchStatus%"=="0" pause
exit /b %launchStatus%
