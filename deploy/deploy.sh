#!/usr/bin/env bash
# ==============================================================================
# PACHAS - DOCKER STACK AUTOMATION DEPLOYMENT SCRIPT (BASH)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

STACK_NAME="pachas"
IMAGE_NAME="pachas:latest"

echo "========================================================"
echo "🚀 INICIANDO DESPLIEGUE DE PACHAS EN DOCKER STACK"
echo "========================================================"

# 1. Comprobar si Docker está en ejecución
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker no está en ejecución. Por favor arranca el daemon de Docker."
    exit 1
fi

# 2. Inicializar Docker Swarm si no está activo
if ! docker node ls >/dev/null 2>&1; then
    echo "⚙️ Inicializando Docker Swarm..."
    docker swarm init || true
else
    echo "✅ Docker Swarm ya está inicializado."
fi

# 3. Cargar variables de entorno
ENV_FILE="${SCRIPT_DIR}/.env.production"
if [ ! -f "${ENV_FILE}" ]; then
    echo "⚠️ Archivo .env.production no encontrado. Copiando desde env.example..."
    cp "${SCRIPT_DIR}/env.example" "${ENV_FILE}"
fi

export $(grep -v '^#' "${ENV_FILE}" | xargs -0) 2>/dev/null || true

# 4. Construir la imagen Docker de la aplicación
echo "📦 Construyendo imagen de producción (${IMAGE_NAME})..."
cd "${ROOT_DIR}"
docker build -f deploy/Dockerfile -t "${IMAGE_NAME}" .

# 5. Desplegar el Stack en Swarm
echo "🚀 Desplegando Docker Stack: '${STACK_NAME}'..."
cd "${SCRIPT_DIR}"
docker stack deploy -c docker-stack.yml "${STACK_NAME}"

echo ""
echo "========================================================"
echo "✅ STACK DESPLEGADO CON ÉXITO"
echo "========================================================"
echo "Para comprobar el estado de los servicios:"
echo "  docker stack services ${STACK_NAME}"
echo "  docker stack ps ${STACK_NAME}"
echo ""
echo "Para ver logs en tiempo real:"
echo "  docker service logs -f ${STACK_NAME}_app"
echo ""
echo "Accede a la app en: http://localhost:3000"
echo "========================================================"
