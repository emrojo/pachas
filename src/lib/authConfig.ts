import { Profile, Group, GroupMember } from '@/types/database';

/**
 * Checks if the application is running in production mode
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_DEMO_USERS !== 'true';
};

/**
 * Checks if demo / test user logins and fast-switchers are permitted
 * In production mode, test user login is strictly prohibited.
 */
export const isDemoModeAllowed = (): boolean => {
  return !isProduction();
};

/**
 * Checks if a given user has Administrator privileges
 * (System admin role, group creator, or group admin)
 */
export const isUserAdmin = (
  user: Profile | null | undefined,
  groups?: Group[],
  members?: Record<string, GroupMember[]>
): boolean => {
  if (!user) return false;

  // 1. Direct admin role on profile
  if (user.role === 'admin') return true;

  // 2. Created any group
  if (groups && groups.some((g) => g.created_by === user.id)) {
    return true;
  }

  // 3. Admin role in any group member list
  if (members) {
    for (const groupMembers of Object.values(members)) {
      if (groupMembers.some((m) => m.user_id === user.id && m.role === 'admin')) {
        return true;
      }
    }
  }

  return false;
};
