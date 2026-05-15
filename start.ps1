param(
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$root       = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $root "frontend"
$backendDir  = Join-Path $root "backend"
$venvDir     = Join-Path $backendDir "venv"
$pipExe      = Join-Path $venvDir "Scripts\pip.exe"
$uvicornExe  = Join-Path $venvDir "Scripts\uvicorn.exe"
$envFile     = Join-Path $backendDir ".env"
$envExample  = Join-Path $backendDir ".env.example"

if (-not (Test-Path $backendDir) -or -not (Test-Path $frontendDir)) {
  Write-Error "Не найдены папки backend/ или frontend/. Запускай start.ps1 из корня проекта."
}

# ── [0] git pull только если это git-репозиторий ─────────────────────────────
if (Test-Path (Join-Path $root ".git")) {
  Write-Host "[0] Обновление из git..." -ForegroundColor Green
  Push-Location $root
  git pull
  Pop-Location
} else {
  Write-Host "[0] git не обнаружен (архив) — пропускаем pull" -ForegroundColor Yellow
}

# ── [1] Создать .env если его нет ────────────────────────────────────────────
if (-not (Test-Path $envFile)) {
  Write-Host ""
  Write-Host "[1] Файл backend/.env не найден — создаём..." -ForegroundColor Yellow

  if (-not (Test-Path $envExample)) {
    Write-Error "Не найден backend/.env.example. Файлы проекта повреждены."
  }

  $dbUser = Read-Host "  Пользователь PostgreSQL (Enter = postgres)"
  if (-not $dbUser) { $dbUser = "postgres" }

  $dbPassRaw = Read-Host "  Пароль PostgreSQL (Enter = postgres)"
  if (-not $dbPassRaw) { $dbPassRaw = "postgres" }

  $dbName = Read-Host "  Имя базы данных (Enter = gradus)"
  if (-not $dbName) { $dbName = "gradus" }

  $dbUrl = "postgresql://${dbUser}:${dbPassRaw}@localhost:5432/${dbName}"

  $envContent = Get-Content $envExample -Raw
  $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=$dbUrl"
  # Отключаем Redis по умолчанию — не у всех он установлен
  $envContent = $envContent -replace "REDIS_ENABLED=true", "REDIS_ENABLED=false"
  Set-Content -Path $envFile -Value $envContent -Encoding utf8

  Write-Host "  .env создан. DATABASE_URL=$dbUrl" -ForegroundColor Green
} else {
  Write-Host "[1] backend/.env уже существует — пропускаем" -ForegroundColor Green
}

# ── [2] Установка зависимостей ────────────────────────────────────────────────
if (-not $NoInstall) {
  Write-Host "[2] Установка зависимостей бэкенда..." -ForegroundColor Green
  Push-Location $backendDir
  if (-not (Test-Path $venvDir)) {
    python -m venv $venvDir
  }
  & $pipExe install -q -r requirements.txt
  Pop-Location

  Write-Host "[3] Установка зависимостей фронтенда..." -ForegroundColor Green
  Push-Location $frontendDir
  npm install --silent
  Pop-Location
}

# ── [4] Запуск бэкенда ───────────────────────────────────────────────────────
Write-Host "[4] Запуск бэкенда (FastAPI :4000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backendDir'; & '$uvicornExe' app.main:app --host 0.0.0.0 --port 4000 --reload"
)

# ── [5] Запуск фронтенда ─────────────────────────────────────────────────────
Write-Host "[5] Запуск фронтенда (Vite :5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontendDir'; npm run dev"
)

Write-Host ""
Write-Host "Готово!" -ForegroundColor Green
Write-Host "  Сайт:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API:    http://localhost:4000"
Write-Host "  Docs:   http://localhost:4000/api/docs"
Write-Host ""
Write-Host "Демо-аккаунты:" -ForegroundColor DarkGray
Write-Host "  student@gradus.dev  / Student@12345" -ForegroundColor DarkGray
Write-Host "  teacher@gradus.dev  / Teacher@12345" -ForegroundColor DarkGray
Write-Host "  admin@gradus.dev    / Admin@12345" -ForegroundColor DarkGray
