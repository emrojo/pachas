#!/usr/bin/env bash

# ==============================================================================
# PACHAS - BASH WRAPPER PARA ROTACIÓN DE SECRETOS
# ==============================================================================
# Uso:
#   ./deploy/rotate-secrets.sh                     # Modo interactivo
#   ./deploy/rotate-secrets.sh --all               # Rotar todo en local
#   ./deploy/rotate-secrets.sh --all --prod --reload # Rotar producción y recargar
#   ./deploy/rotate-secrets.sh --jwt               # Rotar solo JWT
#   ./deploy/rotate-secrets.sh --postgres          # Rotar solo PostgreSQL
#   ./deploy/rotate-secrets.sh --service systemd   # Forzar recarga systemd pachas.service
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/rotate-secrets.mjs"

node "$NODE_SCRIPT" "$@"
