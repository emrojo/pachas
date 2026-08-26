# ==============================================================================
# PACHAS - START NATIVE NODE.JS PRODUCTION SERVER (POWERSHELL)
# ==============================================================================

param (
    [int]$Port = 3000,
    [switch]$BuildFirst = $false,
    [switch]$Cluster = $false
)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 =======================================================" -ForegroundColor Cyan
Write-Host "🚀 PACHAS - NATIVE NODE.JS PRODUCTION MODE" -ForegroundColor Cyan
Write-Host "🚀 =======================================================`n" -ForegroundColor Cyan

# 1. Optionally compile production build
if ($BuildFirst -or (-not (Test-Path ".next\standalone\server.js"))) {
    Write-Host "⚙️  Compiling Next.js standalone production build..." -ForegroundColor Yellow
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed. Aborting." -ForegroundColor Red
        exit 1
    }
}

# 2. Check if .env.production exists, if not generate it
if (-not (Test-Path "deploy\.env.production")) {
    Write-Host "🔑 Generating secure production secrets..." -ForegroundColor Yellow
    node deploy/generate-secrets.mjs
}

# 3. Start server (Cluster Mode with PM2 or Single Process Standalone)
if ($Cluster) {
    Write-Host "⚡ Starting production cluster with PM2 across all CPU cores..." -ForegroundColor Green
    cmd /c "npx pm2 start ecosystem.config.cjs"
    cmd /c "npx pm2 status"
} else {
    $env:PORT = "$Port"
    $env:NODE_ENV = "production"
    Write-Host "▶️  Launching native Node.js standalone server on port $Port..." -ForegroundColor Green
    node deploy/start-node-prod.mjs
}
