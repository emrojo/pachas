import { CapacitorConfig } from '@capacitor/cli';

/**
 * ==============================================================================
 * PACHAS - SECURE PRODUCTION CAPACITOR CONFIGURATION
 * ==============================================================================
 * Supports two production native modes:
 * 1. Live Remote Mode (via CAPACITOR_SERVER_URL): Connects to live HTTPS server
 *    with instant OTA updates without App Store resubmissions.
 * 2. Static Offline Bundle Mode (default): Bundles Next.js export inside the APK/IPA.
 * ==============================================================================
 */

const liveServerUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.pachas.app',
  appName: 'Pachas',
  webDir: 'out',
  server: {
    ...(liveServerUrl
      ? {
          url: liveServerUrl,
          cleartext: false, // Strictly prohibit unencrypted HTTP in production
        }
      : {}),
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      '*.supabase.co',
      '*.tile.openstreetmap.org',
      '*.unpkg.com',
      liveServerUrl ? new URL(liveServerUrl).hostname : '',
    ].filter(Boolean),
  },
  android: {
    allowMixedContent: false, // Disallow insecure mixed content in Android WebView
    captureInput: true,
    webContentsDebuggingEnabled: false, // Disabled for production security
  },
  ios: {
    allowsLinkPreview: false,
    scrollEnabled: true,
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#022c22',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#022c22',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

