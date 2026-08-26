# ==============================================================================
# PACHAS - CRYPTOGRAPHIC PRODUCTION SECRETS GENERATOR (POWERSHELL)
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "🔒 =======================================================" -ForegroundColor Cyan
Write-Host "🔒 Pachas - Production Secrets & Security Config Generator" -ForegroundColor Cyan
Write-Host "🔒 =======================================================`n" -ForegroundColor Cyan

node deploy/generate-secrets.mjs

Write-Host "✅ Listo para desplegar con credenciales de alta seguridad." -ForegroundColor Green
