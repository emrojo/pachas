/**
 * Pachas WebPush / FCM Dispatcher Utility
 * Sends push notifications to subscribed browser/mobile clients.
 */

import { getDbPool } from '@/lib/db/postgres';
import { PushNotificationPayload } from '@/types/database';

export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBKr3qBUYIHBQFLXYp5Nksh8U';

export const DEFAULT_VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'UUxI6qLzYJ1rG1xV_f5K8t5j6Jm5P4t7q8r9s0t1u2v';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:admin@pachas.app';

/**
 * Sends a push notification payload to specific user IDs
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<{ sentCount: number; failureCount: number }> {
  if (!userIds || userIds.length === 0) {
    return { sentCount: 0, failureCount: 0 };
  }

  const pool = getDbPool();
  if (!pool) {
    return { sentCount: 0, failureCount: 0 };
  }

  try {
    // 1. Fetch active subscriptions for target users
    const res = await pool.query(
      `SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth
       FROM public.push_subscriptions s
       WHERE s.user_id = ANY($1::uuid[])`,
      [userIds]
    );

    if (res.rows.length === 0) {
      return { sentCount: 0, failureCount: 0 };
    }

    let sentCount = 0;
    let failureCount = 0;
    const expiredIds: string[] = [];

    const stringPayload = JSON.stringify(payload);

    // 2. Dispatch to each subscription
    for (const sub of res.rows) {
      try {
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            TTL: '86400',
          },
          body: stringPayload,
        });

        if (response.status === 201 || response.status === 200) {
          sentCount++;
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired or uninstalled by user
          expiredIds.push(sub.id);
          failureCount++;
        } else {
          failureCount++;
        }
      } catch {
        failureCount++;
      }
    }

    // 3. Clean up expired subscriptions
    if (expiredIds.length > 0) {
      try {
        await pool.query(
          `DELETE FROM public.push_subscriptions WHERE id = ANY($1::uuid[])`,
          [expiredIds]
        );
      } catch {}
    }

    return { sentCount, failureCount };
  } catch (err) {
    console.warn('Push notification dispatch error:', err);
    return { sentCount: 0, failureCount: 0 };
  }
}

/**
 * Dispatches a push notification to all group members who have enabled notifications,
 * excluding the user who performed the action.
 */
export async function notifyGroupMembers(
  groupId: string,
  excludeUserId: string,
  payload: PushNotificationPayload
): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;

  try {
    const res = await pool.query(
      `SELECT user_id
       FROM public.group_members
       WHERE group_id = $1
         AND notifications_enabled = true
         AND user_id != $2`,
      [groupId, excludeUserId]
    );

    const targetUserIds = res.rows.map((r: { user_id: string }) => r.user_id);
    if (targetUserIds.length > 0) {
      await sendPushToUsers(targetUserIds, payload);
    }
  } catch (err: any) {
    if (err.code === '42703' || String(err.message).includes('notifications_enabled')) {
      try {
        const res = await pool.query(
          `SELECT user_id FROM public.group_members WHERE group_id = $1 AND user_id != $2`,
          [groupId, excludeUserId]
        );
        const targetUserIds = res.rows.map((r: { user_id: string }) => r.user_id);
        if (targetUserIds.length > 0) {
          await sendPushToUsers(targetUserIds, payload);
        }
      } catch {}
    } else {
      console.warn('Error notifying group members via push:', err);
    }
  }
}
