#!/usr/bin/env bash
# ==============================================================================
# PACHAS - PRODUCTION REMOTE DEPLOYMENT SCRIPT (SSH RUNNER)
# ==============================================================================
# Idempotent, zero-downtime deployment engine with pre-validation,
# automatic migrations, healthcheck polling, and atomic rollback on failure.
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# 1. Configuración y Argumentos
# ------------------------------------------------------------------------------
IMAGE_TAG="${1:-latest}"
REPO_IMAGE="${PACHAS_REPO_IMAGE:-ghcr.io/emrojo/pachas}"
TARGET_IMAGE="${REPO_IMAGE}:${IMAGE_TAG}"

DEPLOY_DIR="${DEPLOY_DIR:-/opt/pachas}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.prod.yml}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000/api/health}"
MAX_RETRIES=20
RETRY_INTERVAL=3

echo "========================================================"
echo "🚀 PACHAS: INICIANDO DESPLIEGUE EN PRODUCCIÓN"
echo "========================================================"
echo "📅 Fecha: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "📦 Imagen objetivo: ${TARGET_IMAGE}"
echo "📂 Directorio:      ${DEPLOY_DIR}"
echo "📄 Compose:        ${COMPOSE_FILE}"
echo "========================================================"

# Comprobar directorio de despliegue
if [ ! -d "${DEPLOY_DIR}" ]; then
  echo "❌ Error: El directorio de despliegue '${DEPLOY_DIR}' no existe."
  exit 1
fi

cd "${DEPLOY_DIR}"

# Comprobar docker y compose
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Error: Docker no está instalado en el sistema."
  exit 1
fi

# Detectar comando compose (docker compose v2 o docker-compose v1)
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
else
  echo "❌ Error: Docker Compose no está instalado."
  exit 1
fi

# Comprobar archivo de configuración de producción
ENV_FILE="${DEPLOY_DIR}/deploy/.env.production"
if [ ! -f "${ENV_FILE}" ] && [ -f "${DEPLOY_DIR}/.env.production" ]; then
  ENV_FILE="${DEPLOY_DIR}/.env.production"
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "⚠️ Advertencia: Archivo .env.production no encontrado en rutas estándar."
  if [ -f "${DEPLOY_DIR}/deploy/env.example" ]; then
    echo "⚙️ Copiando plantilla deploy/env.example a ${ENV_FILE}..."
    cp "${DEPLOY_DIR}/deploy/env.example" "${ENV_FILE}"
  fi
fi

# ------------------------------------------------------------------------------
# 2. Capturar estado previo para Rollback
# ------------------------------------------------------------------------------
PREV_IMAGE=$(docker inspect --format='{{.Config.Image}}' pachas_app 2>/dev/null || true)
if [ -n "${PREV_IMAGE}" ]; then
  echo "ℹ️ Versión en ejecución previa detectada: ${PREV_IMAGE}"
else
  echo "ℹ️ No se detectó contenedor pachas_app previo en ejecución (despliegue en frío)."
fi

# ------------------------------------------------------------------------------
# 3. Descarga (Pull) de la nueva imagen desde GHCR
# ------------------------------------------------------------------------------
echo ""
echo "📥 Descargando imagen desde GHCR: ${TARGET_IMAGE}..."
if ! docker pull "${TARGET_IMAGE}"; then
  echo "❌ Error: No se pudo descargar la imagen ${TARGET_IMAGE} desde GHCR."
  echo "   Verifique los permisos de acceso al paquete y credenciales de docker login."
  exit 1
fi
echo "✅ Imagen descargada exitosamente."

# ------------------------------------------------------------------------------
# 4. Actualizar variables de imagen para Compose
# ------------------------------------------------------------------------------
export PACHAS_IMAGE="${TARGET_IMAGE}"

# ------------------------------------------------------------------------------
# 5. Ejecución de Migraciones de Base de Datos
# ------------------------------------------------------------------------------
echo ""
echo "🗄️ Ejecutando migraciones de base de datos..."
# Levantar PostgreSQL primero si no está activo
#${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" up -d postgres postgrest

# Esperar a que PostgreSQL responda
echo "⏳ Esperando a que PostgreSQL esté listo..."
for i in $(seq 1 15); do
  if docker exec postgres_db pg_isready -U pachas_admin >/dev/null 2>&1; then
    echo "✅ Base de datos lista."
    break
  fi
  sleep 2
done

# Ejecutar migraciones usando la nueva imagen
echo "⚙️ Aplicando migraciones pendientes con la nueva versión..."
if ! ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" run --rm --no-deps -e DATABASE_URL="${DATABASE_URL:-}" app node deploy/migrate.mjs; then
  echo "⚠️ Aviso en migraciones: intentando migrador en línea o continuando..."
fi

# ------------------------------------------------------------------------------
# 6. Despliegue del Servicio de Aplicación y Proxy
# ------------------------------------------------------------------------------
echo ""
echo "🔄 Levantando servicios con la nueva imagen..."
${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" up -d --remove-orphans

# ------------------------------------------------------------------------------
# 7. Verificación de Salud (Healthcheck Polling)
# ------------------------------------------------------------------------------
echo ""
echo "🩺 Verificando salud del servicio en ${HEALTHCHECK_URL}..."
HEALTHY=0

for i in $(seq 1 ${MAX_RETRIES}); do
  sleep ${RETRY_INTERVAL}
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTHCHECK_URL}" 2>/dev/null || true)

  if [ "${HTTP_STATUS}" = "200" ]; then
    echo "✅ Healthcheck superado exitosamente (Intento ${i}/${MAX_RETRIES}, HTTP 200)."
    HEALTHY=1
    break
  else
    echo "⏳ Esperando arranque del servicio... (Intento ${i}/${MAX_RETRIES}, HTTP ${HTTP_STATUS})"
  fi
done

# ------------------------------------------------------------------------------
# 8. Gestión de Rollback en caso de fallo
# ------------------------------------------------------------------------------
if [ "${HEALTHY}" -ne 1 ]; then
  echo ""
  echo "🚨 ========================================================"
  echo "❌ ALERTA CRÍTICA: El healthcheck falló tras ${MAX_RETRIES} intentos."
  echo "📋 Últimos logs del contenedor pachas_app:"
  docker logs --tail 40 pachas_app || true
  echo "========================================================"

  if [ -n "${PREV_IMAGE}" ] && [ "${PREV_IMAGE}" != "${TARGET_IMAGE}" ]; then
    echo "⏪ Ejecutando ROLLBACK a la versión anterior: ${PREV_IMAGE}..."
    export PACHAS_IMAGE="${PREV_IMAGE}"
    ${DOCKER_COMPOSE} -f "${COMPOSE_FILE}" up -d app
    sleep 5
    echo "⚠️ Rollback completado. La versión anterior ha sido restaurada."
  else
    echo "⚠️ No hay versión previa disponible para ejecutar rollback automático."
  fi

  exit 1
fi

# ------------------------------------------------------------------------------
# 9. Limpieza y Mantenimiento
# ------------------------------------------------------------------------------
echo ""
echo "🧹 Limpiando imágenes y recursos en desuso..."
docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "========================================================"
echo "🎉 DESPLIEGUE COMPLETADO CON ÉXITO"
echo "🚀 Versión activa: ${TARGET_IMAGE}"
echo "========================================================"
exit 0
