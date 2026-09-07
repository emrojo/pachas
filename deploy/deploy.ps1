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

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $name = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"').Trim("'")
            if (-not [System.Environment]::GetEnvironmentVariable($name)) {
                [System.Environment]::SetEnvironmentVariable($name, $val)
            }
        }
    }
}

# 4. Construir imagen Docker
Write-Host ">> Construyendo imagen de produccion ($ImageName)..." -ForegroundColor Cyan
Set-Location $RootDir
docker build -f deploy/Dockerfile `
    --build-arg NEXT_PUBLIC_SUPABASE_URL="$env:NEXT_PUBLIC_SUPABASE_URL" `
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$env:NEXT_PUBLIC_SUPABASE_ANON_KEY" `
    --build-arg NEXT_PUBLIC_ADMIN_EMAIL="$env:NEXT_PUBLIC_ADMIN_EMAIL" `
    --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="$env:NEXT_PUBLIC_GOOGLE_CLIENT_ID" `
    -t $ImageName .

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
