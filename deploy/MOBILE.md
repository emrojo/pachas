# 📱 Pachas Mobile App Guide — PWA & Secure Native Capacitor Wrapper

This guide explains how **Pachas** operates on mobile devices, covering **Progressive Web App (PWA)** installation, **Secure Native Packaging with Capacitor.js** for Google Play Store and Apple App Store, and automated release pipelines.

---

## 📑 Table of Contents
1. [Option 1: Progressive Web App (PWA) — Instant & Free](#1-option-1-progressive-web-app-pwa)
2. [Option 2: Secure Native App with Capacitor.js (App Stores)](#2-option-2-secure-native-app-with-capacitorjs)
3. [⚡ Automated 1-Click Native Build Pipeline](#3-automated-1-click-native-build-pipeline)
4. [Android Build & Release Process (Google Play)](#4-android-build--release-process)
5. [iOS Build & Release Process (Apple App Store)](#5-ios-build--release-process)
6. [Security & Hardware Access in Production](#6-security--hardware-access-in-production)

---

## 1. Option 1: Progressive Web App (PWA)

Pachas is fully configured as an installable **Progressive Web App** via `public/manifest.json`, mobile meta tags in `src/app/layout.tsx`, and adaptive responsive design with Tailwind CSS.

### 🍏 iOS / iPhone Installation (Safari)
1. Open your deployed Pachas URL in **Safari** (e.g. `https://pachas.yourdomain.com`).
2. Tap the **Share** button (square with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"** (*Añadir a pantalla de inicio*).
4. Tap **Add**.
5. The Pachas app icon appears on your home screen and launches in **full-screen standalone mode** (without the Safari address bar or navigation buttons).

### 🤖 Android Installation (Chrome / Edge)
1. Open the URL in **Chrome** or **Edge**.
2. Tap the banner **"Add Pachas to Home Screen"** or open the 3-dot menu and select **"Install App"**.
3. The app is added to your app drawer and home screen.

---

## 2. Option 2: Secure Native App with Capacitor.js

Capacitor embeds your Pachas application inside an official **WKWebView (iOS)** and **Android WebView**, generating complete Xcode and Android Studio projects ready for app store distribution.

### Hardened Production Modes in `capacitor.config.ts`

#### A. Remote Live HTTPS Server (Recommended for Instant OTA Updates)
Connects directly to your hosted production server with SSL encryption (`cleartext: false`):
```bash
# Build & sync targeting your live production URL
.\deploy\build-native.ps1 -Platform android -ServerUrl "https://pachas.yourdomain.com"
```
- **Advantage**: Any new feature, hotfix, or UI update deployed to your server is **instantly available** on all user devices without waiting for App Store / Google Play review!

#### B. Standalone Offline Bundle
Pre-compiles your frontend into static assets inside the app binary:
```bash
# Build & sync targeting offline standalone mode
.\deploy\build-native.ps1 -Platform android
```

---

## 3. ⚡ Automated 1-Click Native Build Pipeline

We provide cross-platform automated build scripts that compile Next.js, sync native assets, and open the native IDE:

### On Windows (PowerShell):
```powershell
# Android Release Build:
.\deploy\build-native.ps1 -Platform android

# Android Live URL Mode:
.\deploy\build-native.ps1 -Platform android -ServerUrl "https://pachas.yourdomain.com"

# iOS Release Build:
.\deploy\build-native.ps1 -Platform ios
```

### On Linux / macOS:
```bash
chmod +x deploy/build-native.sh

# Android:
./deploy/build-native.sh android

# iOS:
./deploy/build-native.sh ios "https://pachas.yourdomain.com"
```

---

## 4. Android Build & Release Process (Google Play)

### Prerequisites
- [Android Studio](https://developer.android.com/studio) installed.
- Java Development Kit (JDK 17+).

### Step-by-Step Build
1. **Initialize Android Native Project** (only once):
   ```bash
   npm run cap:add:android
   ```
2. **Execute Automated Pipeline**:
   ```bash
   npm run cap:sync:prod
   npm run cap:android
   ```
3. **Generate Signed Android App Bundle (.aab)**:
   - In Android Studio: **Build > Generate Signed Bundle / APK**.
   - Select **Android App Bundle (.aab)** for Google Play Console submission.
   - Choose your Keystore, configure alias, and sign the release build.
   - Upload the `.aab` file to **Google Play Console > Production track**.

---

## 5. iOS Build & Release Process (Apple App Store)

### Prerequisites
- macOS machine with [Xcode](https://developer.apple.com/xcode/) installed.
- Apple Developer Account ($99/year) for App Store distribution.

### Step-by-Step Build
1. **Initialize iOS Native Project** (only once on macOS):
   ```bash
   npm run cap:add:ios
   ```
2. **Execute Automated Pipeline**:
   ```bash
   npm run cap:sync:prod
   npm run cap:ios
   ```
3. **Build & Archive for TestFlight / App Store**:
   - In Xcode, select **Any iOS Device (arm64)** as build target.
   - Ensure Signing & Capabilities has your Apple Team selected.
   - Go to **Product > Archive**.
   - Click **Distribute App** to upload to App Store Connect / TestFlight.

---

## 6. Security & Hardware Access in Production

### Security Hardening in Native Mode:
- **`cleartext: false`**: Blocks unencrypted HTTP requests inside the native app.
- **Mixed Content Blocked**: Prohibits mixed HTTP/HTTPS assets on Android WebView.
- **Web Contents Debugging Disabled**: Prevents inspection/tampering in production release builds.
- **Safe Area Insets**: Full support for Notch & Dynamic Island (`pt-safe`, `pb-safe`).

### Pre-configured Plugins:
| Plugin | Purpose |
| :--- | :--- |
| `@capacitor/splash-screen` | Native startup splash screen with brand emerald background `#022c22`. |
| `@capacitor/status-bar` | Customizes phone status bar color and dark/light mode icons. |
| `@capacitor/haptics` | Provides tactile vibration feedback on expense creation or settlements. |

