#!/usr/bin/env bash
# ==============================================================================
# PACHAS - DATABASE RESET SCRIPT (BASH)
# ==============================================================================
set -e

STACK_NAME="pachas"

echo "========================================================"
echo "⚠️  RESETEO COMPLETO DE BASE DE DATOS - PACHAS"
echo "========================================================"
echo "Esta acción eliminará TODOS los grupos, gastos, usuarios y saldos."
echo ""

read -p "¿Estás seguro de que deseas resetear la base de datos? (s/N): " confirm
if [[ ! "$confirm" =~ ^[sSyY]$ ]]; then
    echo "Operación cancelada."
    exit 0
fi

echo ""
echo ">> 1. Deteniendo stack / servicios..."
docker stack rm "${STACK_NAME}" 2>/dev/null || true
sleep 5

echo ">> 2. Eliminando volumen persistente de base de datos..."
docker volume rm "${STACK_NAME}_postgres_data" 2>/dev/null || true

echo ""
echo "========================================================"
echo "✅ BASE DE DATOS RESETEADA CON ÉXITO"
echo "========================================================"
echo "La base de datos está completamente limpia."
echo "Para desplegar de nuevo la aplicación, ejecuta:"
echo "  ./deploy/deploy.sh"
echo "========================================================"
