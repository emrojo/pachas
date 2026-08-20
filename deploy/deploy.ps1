# ==============================================================================
# PACHAS - DOCKER STACK AUTOMATION DEPLOYMENT SCRIPT (POWERSHELL)
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

$StackName = "pachas"
$ImageName = "pachas:latest"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ">> INICIANDO DESPLIEGUE DE PACHAS EN DOCKER STACK" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Comprobar Docker
try {
    docker info | Out-Null
} catch {
    Write-Error "Error: Docker no esta en ejecucion. Por favor inicia Docker Desktop."
    exit 1
}

# 2. Comprobar e inicializar Docker Swarm
$isSwarmActive = $false
try {
    $swarmStatus = docker info --format '{{.Swarm.LocalNodeState}}'
    if ($swarmStatus -eq "active") {
        $isSwarmActive = $true
    }
} catch {}

if (-not $isSwarmActive) {
    Write-Host ">> Inicializando Docker Swarm..." -ForegroundColor Yellow
    docker swarm init
} else {
    Write-Host "OK: Docker Swarm ya esta inicializado." -ForegroundColor Green
}

# 3. Archivo de variables de entorno
$EnvFile = Join-Path $ScriptDir ".env.production"
if (-not (Test-Path $EnvFile)) {
    Write-Host "Archivo .env.production no encontrado. Copiando desde env.example..." -ForegroundColor Yellow
    Copy-Item (Join-Path $ScriptDir "env.example") $EnvFile
}

# 4. Construir imagen Docker
Write-Host ">> Construyendo imagen de produccion ($ImageName)..." -ForegroundColor Cyan
Set-Location $RootDir
docker build -f deploy/Dockerfile -t $ImageName .

# 5. Desplegar Stack
Write-Host ">> Desplegando Docker Stack: '$StackName'..." -ForegroundColor Cyan
Set-Location $ScriptDir
docker stack deploy -c docker-stack.yml $StackName

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "OK: STACK DESPLEGADO CON EXITO" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Para comprobar el estado de los servicios:"
Write-Host "  docker stack services $StackName" -ForegroundColor White
Write-Host "  docker stack ps $StackName" -ForegroundColor White
Write-Host ""
Write-Host "Para ver logs en tiempo real:"
Write-Host "  docker service logs -f pachas_app" -ForegroundColor White
Write-Host ""
Write-Host "Accede a la app en: http://localhost:3000" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Green
