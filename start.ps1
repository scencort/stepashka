param(
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $root "frontend"
$backendDir  = Join-Path $root "backend"
$venvDir     = Join-Path $backendDir "venv"
$pipExe      = Join-Path $venvDir "Scripts\pip.exe"
$uvicornExe  = Join-Path $venvDir "Scripts\uvicorn.exe"

if (-not (Test-Path $backendDir) -or -not (Test-Path $frontendDir)) {
  Write-Error "Missing folders. Run from project root."
}

Write-Host "[0/4] Pulling latest changes from git..." -ForegroundColor Green
Push-Location $root
git pull
Pop-Location

if (-not $NoInstall) {
  Write-Host "[1/5] Installing backend deps..." -ForegroundColor Green
  Push-Location $backendDir
  if (-not (Test-Path $venvDir)) {
    python -m venv $venvDir
  }
  & $pipExe install -q -r requirements.txt
  Pop-Location

  Write-Host "[2/5] Installing frontend deps..." -ForegroundColor Green
  Push-Location $frontendDir
  npm install --silent
  Pop-Location
}

Write-Host "[3/5] Starting backend (FastAPI on :4000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backendDir'; & '$uvicornExe' app.main:app --host 0.0.0.0 --port 4000 --reload"
)

Write-Host "[4/5] Starting frontend (Vite on :5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontendDir'; npm run dev"
)

Write-Host ""
Write-Host "[5/5] Ready!" -ForegroundColor Green
Write-Host "  Site:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API:     http://localhost:4000"
Write-Host "  Docs:    http://localhost:4000/api/docs"
Write-Host ""
Write-Host "Requires: PostgreSQL running, DATABASE_URL set in backend/.env"
