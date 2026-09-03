@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ===================================================
echo        🚀 Pachas Auto-Deploy & Commit AI
echo ===================================================
echo.

:: 1. Validar que estamos en un repositorio Git
git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Error: No estás dentro de un repositorio Git.
    pause
    exit /b 1
)

:: 2. Ejecutar script de sugerencia con Gemini
node "%~dp0deploy\suggest-commit-msg.mjs"
if %errorlevel% neq 0 (
    echo.
    echo [!] No se pudo generar la sugerencia o no hay cambios pendientes.
    pause
    exit /b 1
)

:: 3. Recuperar el mensaje sugerido generado en el archivo temporal
set "MSG_FILE=%TEMP%\pachas_suggested_msg.txt"
set "SUGGESTED_MSG="
if exist "%MSG_FILE%" (
    set /p SUGGESTED_MSG=<"%MSG_FILE%"
    del "%MSG_FILE%" >nul 2>&1
)

echo.
echo ---------------------------------------------------
echo Opciones:
echo   [Enter]   Usar la sugerencia y continuar despliegue
echo   [Escribe] Escribir tu propio mensaje
echo   [Ctrl+C]  Cancelar
echo ---------------------------------------------------
set /p USER_CHOICE="Tu mensaje [Enter para aceptar sugerencia]: "

if defined USER_CHOICE (
    set "COMMIT_MSG=!USER_CHOICE!"
) else (
    set "COMMIT_MSG=!SUGGESTED_MSG!"
)

if not defined COMMIT_MSG (
    set "COMMIT_MSG=chore: automated deploy update"
)

echo.
echo 📦 Preparando commit con: "!COMMIT_MSG!"
git add .
git commit -m "!COMMIT_MSG!"
if %errorlevel% neq 0 (
    echo [X] Error al realizar git commit.
    pause
    exit /b 1
)

echo.
echo 🌐 Subiendo cambios a GitHub...
git push origin HEAD
if %errorlevel% neq 0 (
    echo [X] Error al realizar git push.
    pause
    exit /b 1
)

echo.
echo 🚀 Desplegando en servidor remoto (SSH)...
ssh pachas "cd /var/www/pachas && sudo -u nodeuser git pull origin main && sudo -u nodeuser npm install && sudo -u nodeuser npm run build && sudo -u nodeuser npm run db:migrate && sudo systemctl restart pachas.service"

echo.
echo ===================================================
echo ✅ Despliegue completado con éxito.
echo ===================================================


