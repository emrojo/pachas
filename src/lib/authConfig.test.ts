import { describe, it, expect } from 'vitest';
import { isAppAdmin, isGroupAdmin } from './authConfig';
import { Profile, Group, GroupMember } from '@/types/database';

describe('Role Separation: App Admin vs Group Admin', () => {
  const superAdminUser: Profile = {
    id: 'admin-uuid',
    email: 'admin@pachas.app',
    full_name: 'Super Admin',
    role: 'admin',
    created_at: new Date().toISOString(),
  };

  const regularUser: Profile = {
    id: 'user-carlos',
    email: 'carlos@example.com',
    full_name: 'Carlos Ruiz',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  const groupA: Group = {
    id: 'group-beach',
    name: 'Vacaciones Playa',
    icon_emoji: '🏖️',
    base_currency: 'EUR',
    invite_code: 'BEACH123',
    created_by: 'user-carlos',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const groupMembersA: GroupMember[] = [
    {
      id: 'gm-1',
      group_id: 'group-beach',
      user_id: 'user-carlos',
      role: 'admin',
      joined_at: new Date().toISOString(),
    },
    {
      id: 'gm-2',
      group_id: 'group-beach',
      user_id: 'user-other',
      role: 'member',
      joined_at: new Date().toISOString(),
    },
  ];

  it('identifies Superadmin correctly for platform backoffice access', () => {
    expect(isAppAdmin(superAdminUser)).toBe(true);
    expect(isAppAdmin(regularUser)).toBe(false);
  });

  it('grants Group Admin to group creator, but NOT App Admin access', () => {
    // Carlos created group-beach -> He is Group Admin of group-beach
    expect(isGroupAdmin('group-beach', regularUser, groupA, groupMembersA)).toBe(true);

    // But Carlos is strictly NOT an App Admin (cannot access Backoffice)
    expect(isAppAdmin(regularUser)).toBe(false);
  });

  it('denies Group Admin on other groups to non-members or regular members', () => {
    const regularMember: Profile = {
      id: 'user-other',
      email: 'other@example.com',
      full_name: 'Otro Amigo',
      role: 'member',
      created_at: new Date().toISOString(),
    };

    // 'user-other' is regular member, not admin of group-beach
    expect(isGroupAdmin('group-beach', regularMember, groupA, groupMembersA)).toBe(false);

    // 'user-carlos' is not admin of another group
    expect(isGroupAdmin('group-mountain', regularUser, { ...groupA, id: 'group-mountain', created_by: 'someone-else' }, [])).toBe(false);
  });

  it('recognizes App Admin matching ADMIN_EMAIL or NEXT_PUBLIC_ADMIN_EMAIL', () => {
    const originalEnv = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    try {
      process.env.NEXT_PUBLIC_ADMIN_EMAIL = 'custom-admin@example.com, boss@company.org';

      const customAdminUser: Profile = {
        id: 'user-custom',
        email: 'custom-admin@example.com',
        full_name: 'Custom Admin',
        role: 'member', // Even if role is member in DB, email match makes them App Admin
        created_at: new Date().toISOString(),
      };

      const secondAdminUser: Profile = {
        id: 'user-boss',
        email: 'boss@company.org',
        full_name: 'Boss',
        role: 'member',
        created_at: new Date().toISOString(),
      };

      expect(isAppAdmin(customAdminUser)).toBe(true);
      expect(isAppAdmin(secondAdminUser)).toBe(true);
      expect(isAppAdmin({ ...regularUser, email: 'non-admin@example.com' })).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_ADMIN_EMAIL = originalEnv;
    }
  });

  it('grants global isGroupAdmin privileges to Superadmins for any group', () => {
    // Superadmin inspecting an unrelated third-party group
    const foreignGroup: Group = {
      id: 'group-stranger-trip',
      name: 'Viaje Privado Ajenos',
      icon_emoji: '🚗',
      base_currency: 'USD',
      invite_code: 'STRANGE1',
      created_by: 'stranger-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(isGroupAdmin('group-stranger-trip', superAdminUser, foreignGroup, [])).toBe(true);
    expect(isGroupAdmin('any-other-random-id', superAdminUser)).toBe(true);
  });
});
