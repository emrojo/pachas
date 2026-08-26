#!/usr/bin/env bash

# ==============================================================================
# PACHAS - AUTOMATED SECURE NATIVE BUILD PIPELINE (LINUX / MACOS)
# ==============================================================================

set -e

PLATFORM="${1:-android}"
SERVER_URL="${2:-}"

echo -e "\n\033[1;36m📱 =======================================================\033[0m"
echo -e "\033[1;36m📱 PACHAS - SECURE NATIVE APP PRODUCTION BUILD\033[0m"
echo -e "\033[1;36m📱 =======================================================\n\033[0m"

if [ -n "$SERVER_URL" ]; then
    echo -e "\033[1;32m🌐 Mode: REMOTE LIVE SERVER (OTA updates)\033[0m"
    echo -e "\033[0;37m🔗 Server URL: $SERVER_URL\033[0m"
    export CAPACITOR_SERVER_URL="$SERVER_URL"
else
    echo -e "\033[1;32m📦 Mode: STANDALONE OFFLINE BUNDLE\033[0m"
fi

echo -e "\n\033[1;33m⚙️  Step 1/3: Compiling Next.js production build...\033[0m"
npm run build
echo -e "\033[1;32m✅ Next.js compilation completed successfully.\033[0m"

echo -e "\n\033[1;33m🔄 Step 2/3: Syncing web assets and native plugins with Capacitor...\033[0m"
npx cap sync "$PLATFORM"
echo -e "\033[1;32m✅ Capacitor sync completed.\033[0m"

echo -e "\n\033[1;33m🚀 Step 3/3: Opening native IDE for $PLATFORM...\033[0m"
if [ "$PLATFORM" = "android" ]; then
    echo -e "\033[1;36m🤖 Opening Android Studio...\033[0m"
    npx cap open android
elif [ "$PLATFORM" = "ios" ]; then
    echo -e "\033[1;36m🍏 Opening Xcode...\033[0m"
    npx cap open ios
fi

echo -e "\n\033[1;32m🎉 Native production build pipeline prepared successfully!\033[0m\n"
