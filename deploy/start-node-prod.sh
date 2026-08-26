#!/usr/bin/env bash

# ==============================================================================
# PACHAS - START NATIVE NODE.JS PRODUCTION SERVER (LINUX / MACOS)
# ==============================================================================

set -e

PORT="${PORT:-3000}"
CLUSTER="${1:-}"

echo -e "\n\033[1;36m🚀 =======================================================\033[0m"
echo -e "\033[1;36m🚀 PACHAS - NATIVE NODE.JS PRODUCTION MODE\033[0m"
echo -e "\033[1;36m🚀 =======================================================\n\033[0m"

# 1. Compile build if standalone server does not exist
if [ ! -f ".next/standalone/server.js" ]; then
    echo -e "\033[1;33m⚙️  Compiling Next.js standalone production build...\033[0m"
    npm run build
fi

# 2. Check if .env.production exists
if [ ! -f "deploy/.env.production" ]; then
    echo -e "\033[1;33m🔑 Generating secure production secrets...\033[0m"
    node deploy/generate-secrets.mjs
fi

# 3. Start server
if [ "$CLUSTER" = "--cluster" ] || [ "$CLUSTER" = "-c" ]; then
    echo -e "\033[1;32m⚡ Starting production cluster with PM2 across all CPU cores...\033[0m"
    npx pm2 start ecosystem.config.cjs
    npx pm2 status
else
    export PORT="$PORT"
    export NODE_ENV="production"
    echo -e "\033[1;32m▶️  Launching native Node.js standalone server on port $PORT...\033[0m"
    node deploy/start-node-prod.mjs
fi
