# ==============================================================================
# PACHAS - AUTOMATED SECURE NATIVE BUILD PIPELINE (WINDOWS POWERSHELL)
# ==============================================================================

param (
    [string]$Platform = "android",
    [string]$ServerUrl = "",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

Write-Host "`n📱 =======================================================" -ForegroundColor Cyan
Write-Host "📱 PACHAS - SECURE NATIVE APP PRODUCTION BUILD" -ForegroundColor Cyan
Write-Host "📱 =======================================================`n" -ForegroundColor Cyan

# 1. Environment & Server URL configuration
if ($ServerUrl -ne "") {
    Write-Host "🌐 Mode: REMOTE LIVE SERVER (OTA updates)" -ForegroundColor Green
    Write-Host "🔗 Server URL: $ServerUrl" -ForegroundColor Gray
    $env:CAPACITOR_SERVER_URL = $ServerUrl
} else {
    Write-Host "📦 Mode: STANDALONE OFFLINE BUNDLE" -ForegroundColor Green
}

# 2. Next.js Production Build
if (-not $SkipBuild) {
    Write-Host "`n⚙️  Step 1/3: Compiling Next.js production build..." -ForegroundColor Yellow
    cmd /c "npm run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error during Next.js build." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Next.js compilation completed successfully." -ForegroundColor Green
} else {
    Write-Host "⏩ Skipping Next.js build step (-SkipBuild specified)." -ForegroundColor Gray
}

# 3. Synchronize with Capacitor
Write-Host "`n🔄 Step 2/3: Syncing web assets and native plugins with Capacitor..." -ForegroundColor Yellow
cmd /c "npx cap sync $Platform"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error syncing Capacitor native platform." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Capacitor sync completed." -ForegroundColor Green

# 4. Open or Build Native Project
Write-Host "`n🚀 Step 3/3: Opening native IDE for $Platform..." -ForegroundColor Yellow
if ($Platform -eq "android") {
    Write-Host "🤖 Opening Android Studio..." -ForegroundColor Cyan
    cmd /c "npx cap open android"
} elseif ($Platform -eq "ios") {
    Write-Host "🍏 Opening Xcode..." -ForegroundColor Cyan
    cmd /c "npx cap open ios"
}

Write-Host "`n🎉 Native production build pipeline prepared successfully!" -ForegroundColor Green
Write-Host "👉 En Android Studio: Build > Generate Signed Bundle / APK para Google Play" -ForegroundColor Gray
Write-Host "👉 En Xcode: Product > Archive para App Store Connect`n" -ForegroundColor Gray
