param(
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend-python"
$frontendDir = Join-Path $root "frontend"
$backendEnv = Join-Path $backendDir ".env"

if (-not (Test-Path $backendDir) -or -not (Test-Path $frontendDir)) {
  Write-Error "Не найдены папки backend-python/frontend. Запустите скрипт из корня проекта."
}

if (-not $NoInstall) {
  Write-Host "Установка зависимостей backend (Python)..."
  Push-Location $backendDir
  if (-not (Test-Path "venv")) {
    python -m venv venv
  }
  & "venv\Scripts\pip.exe" install -q -r requirements.txt
  Pop-Location

  Write-Host "Установка зависимостей frontend..."
  Push-Location $frontendDir
  npm install
  Pop-Location
}

Write-Host "Запуск backend (FastAPI) в отдельном окне..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backendDir'; & 'venv\Scripts\uvicorn.exe' app.main:app --host 0.0.0.0 --port 4000 --reload"
)

Write-Host "Запуск frontend в отдельном окне..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontendDir'; npm run dev"
)

Write-Host "Готово. Откройте http://localhost:5173"
Write-Host "API docs: http://localhost:4000/api/docs"
Write-Host "Если backend не поднимется — проверьте, что локальный PostgreSQL запущен и DATABASE_URL в backend-python/.env корректный."
