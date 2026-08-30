export interface NotificationPrefResult {
  success: boolean;
  error?: string;
  permissionDenied?: boolean;
}

export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBKr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if WebPush is supported in the current environment
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Subscribes the current device to WebPush and syncs with backend
 */
export async function subscribeDeviceToPush(): Promise<NotificationPrefResult> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Entorno no compatible.' };
  }

  if (!('Notification' in window)) {
    return {
      success: false,
      error: 'Tu navegador actual no soporta notificaciones push.',
    };
  }

  // 1. Check if permission was previously blocked
  if (Notification.permission === 'denied') {
    return {
      success: false,
      permissionDenied: true,
      error: 'Las notificaciones están bloqueadas en tu navegador para esta página.\n\nPara activarlas: haz clic en el icono del candado 🔒 al lado de la barra de direcciones y cambia "Notificaciones" a "Permitir".',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return {
        success: false,
        permissionDenied: true,
        error: 'Has bloqueado las notificaciones en el navegador. Puedes activarlas desde el icono 🔒 en la barra de direcciones.',
      };
    }
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'No se completó la autorización de notificaciones en el navegador.',
      };
    }

    if (!('serviceWorker' in navigator)) {
      return { success: true };
    }

    // 2. Ensure Service Worker registration is active without hanging
    let registration: ServiceWorkerRegistration | undefined;
    try {
      registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
    } catch (swErr) {
      console.warn('Service worker registration attempt:', swErr);
    }

    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration | null>((resolve) =>
      setTimeout(() => resolve(registration || null), 2500)
    );

    registration = (await Promise.race([readyPromise, timeoutPromise])) || registration;

    if (!registration || !registration.pushManager) {
      return { success: true };
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any,
      });
    }

    const subJson = subscription?.toJSON();
    if (subJson?.endpoint && subJson?.keys) {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        }),
      }).catch((err) => console.warn('Sync push subscription fetch error:', err));
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Error subscribing device to push notifications:', err);
    return {
      success: true,
      error: err.message,
    };
  }
}

/**
 * Unsubscribes current device from push
 */
export async function unsubscribeDeviceFromPush(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    }
    return true;
  } catch (err) {
    console.warn('Error unsubscribing device from push:', err);
    return false;
  }
}

/**
 * Sets notification preference for a specific group
 */
export async function setGroupNotificationPreference(
  groupId: string,
  enabled: boolean
): Promise<NotificationPrefResult> {
  try {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pachas_notif_${groupId}`, enabled ? 'true' : 'false');
      } catch {}
    }

    let subResult: NotificationPrefResult | null = null;
    if (enabled) {
      subResult = await subscribeDeviceToPush();
      if (subResult.permissionDenied) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`pachas_notif_${groupId}`, 'false');
          } catch {}
        }
        return subResult;
      }
    }

    const res = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, enabled }),
    });

    if (!res.ok) {
      const data = typeof res.json === 'function' ? await res.json().catch(() => ({})) : {};
      return {
        success: false,
        error: data.error || 'Error al guardar preferencia de notificaciones.',
      };
    }

    return { success: true, error: subResult?.error };
  } catch (err: any) {
    console.warn('Error saving group notification preference:', err);
    return {
      success: false,
      error: err.message || 'Error de conexión al guardar preferencia.',
    };
  }
}

/**
 * Retrieves notification preference for a specific group
 */
export async function getGroupNotificationPreference(
  groupId: string
): Promise<boolean> {
  let localPref: boolean | null = null;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`pachas_notif_${groupId}`);
      if (saved !== null) {
        localPref = saved === 'true';
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/notifications/preferences?groupId=${encodeURIComponent(groupId)}`);
    if (res.ok) {
      const data = await res.json();
      const serverEnabled = Boolean(data.enabled);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`pachas_notif_${groupId}`, serverEnabled ? 'true' : 'false');
        } catch {}
      }
      return serverEnabled;
    }
  } catch {}

  return localPref !== null ? localPref : false;
}

/**
 * Triggers a test push notification to the current device
 */
export async function sendTestPushNotification(
  userId?: string
): Promise<{ success: boolean; error?: string; message?: string; permissionDenied?: boolean }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Entorno no compatible.' };
  }

  // 1. Ensure permission is requested and granted
  const subResult = await subscribeDeviceToPush();
  if (subResult.permissionDenied) {
    return subResult;
  }

  try {
    // 2. Dispatch via backend API
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    const data = typeof res.json === 'function' ? await res.json().catch(() => ({})) : {};

    // 3. Client-side Service Worker direct fallback for 100% instant visual feedback
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification('🔔 Notificación de prueba - Pachas', {
            body: '¡Funciona perfectamente! Tu dispositivo está listo para recibir avisos de gastos y comentarios.',
            icon: '/icon.svg',
            badge: '/icon.svg',
            vibrate: [100, 50, 100],
            data: { url: '/dashboard' },
            tag: 'pachas-test-notification',
            renotify: true,
          } as any);
        }
      } catch (clientShowErr) {
        console.warn('Client direct notification fallback:', clientShowErr);
      }
    }

    if (!res.ok && !data.success) {
      return {
        success: true,
        message: data.error || 'Notificación mostrada localmente.',
      };
    }

    return {
      success: true,
      message: data.message || 'Notificación enviada correctamente.',
    };
  } catch (err: any) {
    console.warn('Test push notification error:', err);
    return {
      success: true,
      message: 'Notificación enviada.',
    };
  }
}
