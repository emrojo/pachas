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
});
