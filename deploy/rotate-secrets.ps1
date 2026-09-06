# ==============================================================================
# PACHAS - POWERSHELL WRAPPER PARA ROTACIÓN DE SECRETOS
# ==============================================================================
# Uso:
#   .\deploy\rotate-secrets.ps1                     # Modo interactivo
#   .\deploy\rotate-secrets.ps1 -All                # Rotar todo en local
#   .\deploy\rotate-secrets.ps1 -All -Prod -Reload  # Rotar todo en producción y recargar
#   .\deploy\rotate-secrets.ps1 -Jwt                # Rotar solo JWT
#   .\deploy\rotate-secrets.ps1 -Postgres           # Rotar solo contraseña de PostgreSQL
#   .\deploy\rotate-secrets.ps1 -Vapid              # Rotar claves WebPush
#   .\deploy\rotate-secrets.ps1 -Service systemd    # Forzar recarga en systemd
# ==============================================================================

param (
    [switch]$All,
    [switch]$Jwt,
    [switch]$Postgres,
    [switch]$Vapid,
    [switch]$Gemini,
    [switch]$Pexels,
    [switch]$Email,
    [switch]$UserPassword,
    [switch]$Prod,
    [switch]$Local,
    [switch]$AllTargets,
    [switch]$Reload,
    [switch]$NoReload,
    [switch]$ApplyDb,
    [string]$Service,
    [string]$Env
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeScript = Join-Path $ScriptDir "rotate-secrets.mjs"

$NodeArgs = @($NodeScript)

if ($All) { $NodeArgs += "--all" }
if ($Jwt) { $NodeArgs += "--jwt" }
if ($Postgres) { $NodeArgs += "--postgres" }
if ($Vapid) { $NodeArgs += "--vapid" }
if ($Gemini) { $NodeArgs += "--gemini" }
if ($Pexels) { $NodeArgs += "--pexels" }
if ($Email) { $NodeArgs += "--email" }
if ($UserPassword) { $NodeArgs += "--user-password" }
if ($Prod) { $NodeArgs += "--prod" }
if ($Local) { $NodeArgs += "--local" }
if ($AllTargets) { $NodeArgs += "--all-targets" }
if ($Reload) { $NodeArgs += "--reload" }
if ($NoReload) { $NodeArgs += "--no-reload" }
if ($ApplyDb) { $NodeArgs += "--apply-db" }
if ($Service) { $NodeArgs += "--service"; $NodeArgs += $Service }
if ($Env) { $NodeArgs += "--env"; $NodeArgs += $Env }

node @NodeArgs
