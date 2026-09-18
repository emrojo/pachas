'use client';

/**
 * Mobile Native lifecycle utilities for Capacitor (Android & iOS).
 * Configures the Status Bar, hides the Splash Screen once the app is loaded,
 * and handles native back-button behaviors.
 */

export async function initNativeMobileApp(): Promise<void> {
  if (typeof window === 'undefined') return;
  const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (!isCapacitor) return;

  try {
    // 1. Hide splash screen after initial render
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {}

  try {
    // 2. Configure native status bar
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    await StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: isDarkMode ? '#022c22' : '#047857' });
  } catch {}
}
