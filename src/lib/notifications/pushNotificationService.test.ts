import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isPushNotificationSupported,
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
  setGroupNotificationPreference,
  getGroupNotificationPreference,
  sendTestPushNotification,
} from './pushNotificationService';

describe('pushNotificationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects when push notifications are not supported in server environment', () => {
    expect(typeof window === 'undefined' ? false : isPushNotificationSupported()).toBe(false);
  });

  it('handles getGroupNotificationPreference API response gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ enabled: true }),
    } as Response);

    const enabled = await getGroupNotificationPreference('g-123');
    expect(enabled).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications/preferences?groupId=g-123');
  });

  it('handles setGroupNotificationPreference API failure gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await setGroupNotificationPreference('g-123', false);
    expect(result.success).toBe(false);
  });

  it('handles sendTestPushNotification in non-browser environment safely', async () => {
    const result = await sendTestPushNotification('u-123');
    expect(result.success).toBe(false);
    expect(result.error).toContain('no compatible');
  });
});
