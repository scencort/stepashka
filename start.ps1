param(
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Если в репозитории есть активный воркtree с изменённым фронтендом — используем его
$worktreeFront = Join-Path $root ".claude\worktrees\sleepy-greider-0da282\frontend"
$defaultFront  = Join-Path $root "frontend"

if (Test-Path $worktreeFront) {
  $frontendDir = $worktreeFront
  Write-Host "Используется фронтенд из ветки с новым дизайном: $frontendDir" -ForegroundColor Cyan
} else {
  $frontendDir = $defaultFront
  Write-Host "Используется фронтенд по умолчанию: $frontendDir" -ForegroundColor Yellow
}

$backendDir = Join-Path $root "backend-python"

if (-not (Test-Path $backendDir) -or -not (Test-Path $frontendDir)) {
  Write-Error "Не найдены нужные папки. Убедитесь, что запускаете скрипт из корня проекта."
}

if (-not $NoInstall) {
  Write-Host "Установка зависимостей backend (Python)..." -ForegroundColor Green
  Push-Location $backendDir
  if (-not (Test-Path "venv")) {
    python -m venv venv
  }
  & "venv\Scripts\pip.exe" install -q -r requirements.txt
  Pop-Location

  Write-Host "Установка зависимостей frontend..." -ForegroundColor Green
  Push-Location $frontendDir
  npm install --silent
  Pop-Location
}

Write-Host "Запуск backend (FastAPI)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backendDir'; & 'venv\Scripts\uvicorn.exe' app.main:app --host 0.0.0.0 --port 4000 --reload"
)

Write-Host "Запуск frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontendDir'; npm run dev"
)

Write-Host ""
Write-Host "Готово!" -ForegroundColor Green
Write-Host "  Сайт:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API:     http://localhost:4000"
Write-Host "  Docs:    http://localhost:4000/api/docs"
Write-Host ""
Write-Host "Требования: PostgreSQL запущен, DATABASE_URL настроен в backend-python/.env"
