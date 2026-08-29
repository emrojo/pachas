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
export async function subscribeDeviceToPush(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys) {
      return false;
    }

    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        },
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn('Error subscribing device to push notifications:', err);
    return false;
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
): Promise<boolean> {
  try {
    if (enabled) {
      // Ensure device is subscribed when enabling
      await subscribeDeviceToPush();
    }

    const res = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, enabled }),
    });

    return res.ok;
  } catch (err) {
    console.warn('Error saving group notification preference:', err);
    return false;
  }
}

/**
 * Retrieves notification preference for a specific group
 */
export async function getGroupNotificationPreference(
  groupId: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/notifications/preferences?groupId=${encodeURIComponent(groupId)}`);
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.enabled);
    }
  } catch {}
  return false;
}
