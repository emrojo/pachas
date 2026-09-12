import { describe, it, expect } from 'vitest';
import { isGroupAdmin as checkIsGroupAdmin } from '@/lib/authConfig';
import { Profile, Group, GroupMember, Expense } from '@/types/database';

describe('Expense Admin Permissions (FR-67)', () => {
  const creatorUser: Profile = {
    id: 'user-creator',
    email: 'creator@example.com',
    full_name: 'Creator Member',
    avatar_url: '',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  const regularMemberUser: Profile = {
    id: 'user-regular',
    email: 'regular@example.com',
    full_name: 'Regular Member',
    avatar_url: '',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  const groupAdminUser: Profile = {
    id: 'user-group-admin',
    email: 'groupadmin@example.com',
    full_name: 'Group Admin',
    avatar_url: '',
    role: 'member',
    created_at: new Date().toISOString(),
  };

  const superAdminUser: Profile = {
    id: 'user-super-admin',
    email: 'superadmin@example.com',
    full_name: 'Super Admin',
    avatar_url: '',
    role: 'admin',
    created_at: new Date().toISOString(),
  };

  const testGroup: Group = {
    id: 'group-123',
    name: 'Vacaciones 2026',
    description: '',
    icon_emoji: '🌴',
    invite_code: 'vac2026',
    created_by: 'user-creator-of-group',
    base_currency: 'EUR',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const groupMembers: GroupMember[] = [
    {
      id: 'gm-1',
      group_id: 'group-123',
      user_id: creatorUser.id,
      role: 'member',
      joined_at: new Date().toISOString(),
      profile: creatorUser,
    },
    {
      id: 'gm-2',
      group_id: 'group-123',
      user_id: regularMemberUser.id,
      role: 'member',
      joined_at: new Date().toISOString(),
      profile: regularMemberUser,
    },
    {
      id: 'gm-3',
      group_id: 'group-123',
      user_id: groupAdminUser.id,
      role: 'admin',
      joined_at: new Date().toISOString(),
      profile: groupAdminUser,
    },
  ];

  const sampleExpense: Expense = {
    id: 'exp-456',
    group_id: 'group-123',
    created_by: creatorUser.id,
    title: 'Cena de bienvenida',
    amount: 150,
    currency: 'EUR',
    category: 'food',
    expense_date: new Date().toISOString(),
    split_type: 'EQUAL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    creator: creatorUser,
    payers: [{ id: 'p-1', expense_id: 'exp-456', user_id: creatorUser.id, amount_paid: 150 }],
    participants: [
      { id: 'part-1', expense_id: 'exp-456', user_id: creatorUser.id, amount_owed: 50 },
      { id: 'part-2', expense_id: 'exp-456', user_id: regularMemberUser.id, amount_owed: 50 },
      { id: 'part-3', expense_id: 'exp-456', user_id: groupAdminUser.id, amount_owed: 50 },
    ],
  };

  function canUserEditExpense(
    user: Profile,
    expense: Expense,
    group: Group,
    members: GroupMember[]
  ): boolean {
    const isCreator = expense.created_by === user.id;
    const isGroupAdminUser = checkIsGroupAdmin(group.id, user, group, members);
    const isAppAdminUser = user.role === 'admin';
    return isCreator || isGroupAdminUser || isAppAdminUser;
  }

  it('allows the original expense creator to edit the expense', () => {
    const canEdit = canUserEditExpense(creatorUser, sampleExpense, testGroup, groupMembers);
    expect(canEdit).toBe(true);
  });

  it('prohibits a regular group member from editing an expense they did not create', () => {
    const canEdit = canUserEditExpense(regularMemberUser, sampleExpense, testGroup, groupMembers);
    expect(canEdit).toBe(false);
  });

  it('allows a group administrator to edit any expense in the group, even if created by another member', () => {
    const canEdit = canUserEditExpense(groupAdminUser, sampleExpense, testGroup, groupMembers);
    expect(canEdit).toBe(true);
  });

  it('allows group creator to edit any expense as an implicit group admin', () => {
    const groupCreatorUser: Profile = {
      id: 'user-creator-of-group',
      email: 'owner@example.com',
      full_name: 'Group Owner',
      avatar_url: '',
      role: 'member',
      created_at: new Date().toISOString(),
    };
    const canEdit = canUserEditExpense(groupCreatorUser, sampleExpense, testGroup, groupMembers);
    expect(canEdit).toBe(true);
  });

  it('allows a platform super administrator to edit any expense', () => {
    const canEdit = canUserEditExpense(superAdminUser, sampleExpense, testGroup, groupMembers);
    expect(canEdit).toBe(true);
  });

  it('allows group administrator to modify all expense fields while preserving original creator id', () => {
    const isAllowed = canUserEditExpense(groupAdminUser, sampleExpense, testGroup, groupMembers);
    expect(isAllowed).toBe(true);

    const updatedExpense: Expense = {
      ...sampleExpense,
      title: 'Cena gourmet modificada por admin',
      amount: 210,
      currency: 'EUR',
      category: 'activities',
      notes: 'Nota añadida por el admin',
      updated_at: new Date().toISOString(),
    };

    expect(updatedExpense.title).toBe('Cena gourmet modificada por admin');
    expect(updatedExpense.amount).toBe(210);
    expect(updatedExpense.category).toBe('activities');
    expect(updatedExpense.notes).toBe('Nota añadida por el admin');
    expect(updatedExpense.created_by).toBe(creatorUser.id);
  });
});
