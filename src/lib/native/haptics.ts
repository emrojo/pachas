'use client';

/**
 * Native Haptics utility with graceful web fallback.
 * Uses @capacitor/haptics when running on native devices (iOS/Android)
 * or navigator.vibrate when supported on mobile web.
 */

export async function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const isCapacitor = Boolean((window as any).Capacitor?.isNativePlatform?.());

    if (isCapacitor) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      switch (type) {
        case 'light':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case 'success':
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case 'warning':
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case 'error':
          await Haptics.notification({ type: NotificationType.Error });
          break;
      }
      return;
    }

    // Web vibration fallback for Android Chrome / mobile browsers
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const durations: Record<string, number | number[]> = {
        light: 15,
        medium: 30,
        heavy: 60,
        success: [20, 50, 20],
        warning: [40, 40],
        error: [50, 50, 50],
      };
      navigator.vibrate(durations[type] || 20);
    }
  } catch {
    // Graceful no-op if device doesn't support haptics
  }
}
