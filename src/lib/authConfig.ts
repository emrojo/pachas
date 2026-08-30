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
 * Checks if a given user has Application / Superadmin Administrator privileges
 * for accessing the Backoffice management dashboard, system health, and global analytics.
 */
export const isAppAdmin = (user: Profile | null | undefined): boolean => {
  if (!user) return false;

  // 1. Direct admin role on profile
  if (user.role === 'admin') return true;

  // 0. Configured admin email from environment variables (comma/space/semicolon separated)
  const envRaw = `${process.env.ADMIN_EMAIL || ''},${process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''}`;
  const adminEmails = envRaw
    .split(/[,;\s]+/)
    .map((e) => e.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter((e) => e.length > 0 && e.includes('@'));

  if (user.email && adminEmails.includes(user.email.trim().toLowerCase())) {
    return true;
  }

  // 2. In demo / local development mode, primary demo admin user (user-1 / ana) is allowed
  if (isDemoModeAllowed()) {
    if (user.id === 'user-1' || user.email === 'ana@example.com' || user.email === 'admin@pachas.app') {
      return true;
    }
  }

  return false;
};

/**
 * Alias for isAppAdmin (Superadmin / Platform Administrator)
 */
export const isSystemAdmin = isAppAdmin;

/**
 * Checks if a given user is an Administrator of a SPECIFIC group
 * (Allowed to edit group details, change base currency, archive/delete group, and add/remove members).
 */
export const isGroupAdmin = (
  groupId: string,
  user: Profile | null | undefined,
  group?: Group | null,
  groupMembers?: GroupMember[]
): boolean => {
  if (!user || !groupId) return false;

  // 0. Superadmins have administrative and moderation access over all groups
  if (isAppAdmin(user)) {
    return true;
  }

  // 1. If group object provided, check if user is the creator
  if (group && group.id === groupId && group.created_by === user.id) {
    return true;
  }

  // 2. If group members list provided, check if user has role 'admin' in this group
  if (groupMembers) {
    const membership = groupMembers.find((m) => m.group_id === groupId && m.user_id === user.id);
    if (membership && membership.role === 'admin') {
      return true;
    }
  }

  return false;
};

/**
 * @deprecated Use `isAppAdmin` for platform backoffice or `isGroupAdmin` for group management.
 */
export const isUserAdmin = isAppAdmin;


