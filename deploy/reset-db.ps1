# ==============================================================================
# PACHAS - DATABASE RESET SCRIPT (POWERSHELL)
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$StackName = "pachas"

Write-Host "========================================================" -ForegroundColor Yellow
Write-Host ">> RESETEO COMPLETO DE BASE DE DATOS - PACHAS" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "Esta accion eliminara TODOS los grupos, gastos, usuarios y saldos." -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Estas seguro de que deseas resetear la base de datos? (S/N)"
if ($confirm -ne "S" -and $confirm -ne "s" -and $confirm -ne "SI" -and $confirm -ne "si" -and $confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Operacion cancelada por el usuario." -ForegroundColor Cyan
    exit 0
}

Write-Host ""
Write-Host ">> 1. Deteniendo stack / servicios..." -ForegroundColor Cyan
try {
    docker stack rm $StackName | Out-Null
    Start-Sleep -Seconds 5
} catch {}

Write-Host ">> 2. Eliminando volumen persistente de base de datos..." -ForegroundColor Cyan
try {
    docker volume rm "${StackName}_postgres_data" | Out-Null
    Write-Host "OK: Volumen ${StackName}_postgres_data eliminado." -ForegroundColor Green
} catch {
    Write-Host "Nota: El volumen no existia o ya fue eliminado." -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "OK: BASE DE DATOS RESETEADA CON EXITO" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "La base de datos esta completamente limpia." -ForegroundColor White
Write-Host "Para desplegar de nuevo la aplicacion, ejecuta:" -ForegroundColor White
Write-Host "  .\deploy\deploy.ps1" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Green
