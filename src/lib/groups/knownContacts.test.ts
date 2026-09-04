import { describe, it, expect } from 'vitest';
import { Group, GroupMember, Profile } from '@/types/database';
import { isGroupAdmin } from '@/lib/authConfig';

describe('Known Contacts & Group Admin Direct Add Protocol', () => {
  const currentUser: Profile = {
    id: 'user-admin-1',
    email: 'admin1@example.com',
    full_name: 'Ana García',
    role: 'member',
    created_at: '2026-01-01T00:00:00Z',
  };

  const friendBob: Profile = {
    id: 'user-bob',
    email: 'bob@example.com',
    full_name: 'Bob Smith',
    role: 'member',
    created_at: '2026-01-01T00:00:00Z',
  };

  const friendCharlie: Profile = {
    id: 'user-charlie',
    email: 'charlie@example.com',
    full_name: 'Charlie Brown',
    role: 'member',
    created_at: '2026-01-01T00:00:00Z',
  };

  const bannedUser: Profile = {
    id: 'user-banned',
    email: 'banned@example.com',
    full_name: 'Banned User',
    role: 'member',
    is_banned: true,
    ban_reason: 'Incumplimiento de términos',
    created_at: '2026-01-01T00:00:00Z',
  };

  const strangerDave: Profile = {
    id: 'user-dave',
    email: 'dave@example.com',
    full_name: 'Dave Stranger',
    role: 'member',
    created_at: '2026-01-01T00:00:00Z',
  };

  const groupTripA: Group = {
    id: 'group-a',
    name: 'Viaje a Roma',
    icon_emoji: '✈️',
    base_currency: 'EUR',
    invite_code: 'ROMA01',
    created_by: currentUser.id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const groupDinnerB: Group = {
    id: 'group-b',
    name: 'Cena de Verano',
    icon_emoji: '🍕',
    base_currency: 'EUR',
    invite_code: 'CENA02',
    created_by: 'someone-else',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  };

  const membersGroupA: GroupMember[] = [
    { id: 'm-1', group_id: 'group-a', user_id: currentUser.id, role: 'admin', joined_at: '2026-01-01', profile: currentUser },
    { id: 'm-2', group_id: 'group-a', user_id: friendBob.id, role: 'member', joined_at: '2026-01-01', profile: friendBob },
    { id: 'm-3', group_id: 'group-a', user_id: bannedUser.id, role: 'member', joined_at: '2026-01-01', profile: bannedUser },
  ];

  const membersGroupB: GroupMember[] = [
    { id: 'm-4', group_id: 'group-b', user_id: currentUser.id, role: 'member', joined_at: '2026-02-01', profile: currentUser },
    { id: 'm-5', group_id: 'group-b', user_id: friendBob.id, role: 'member', joined_at: '2026-02-01', profile: friendBob },
    { id: 'm-6', group_id: 'group-b', user_id: friendCharlie.id, role: 'member', joined_at: '2026-02-01', profile: friendCharlie },
  ];

  it('correctly aggregates known contacts from shared groups excluding self and banned users', () => {
    // Collect all other members in groups where currentUser participates
    const allMembers = [...membersGroupA, ...membersGroupB];
    const knownMap = new Map<string, { profile: Profile; count: number }>();

    allMembers.forEach((m) => {
      if (m.user_id !== currentUser.id && !m.profile?.is_banned) {
        const existing = knownMap.get(m.user_id);
        if (existing) {
          existing.count += 1;
        } else if (m.profile) {
          knownMap.set(m.user_id, { profile: m.profile, count: 1 });
        }
      }
    });

    const knownList = Array.from(knownMap.values());
    const knownIds = knownList.map((k) => k.profile.id);

    // Bob shares both Group A and Group B
    expect(knownIds).toContain('user-bob');
    expect(knownMap.get('user-bob')?.count).toBe(2);

    // Charlie shares Group B
    expect(knownIds).toContain('user-charlie');
    expect(knownMap.get('user-charlie')?.count).toBe(1);

    // Dave has never shared a group with currentUser
    expect(knownIds).not.toContain('user-dave');

    // Banned user is excluded
    expect(knownIds).not.toContain('user-banned');
  });

  it('filters out contacts who are already members of the target group', () => {
    // In group-b, members are currentUser, friendBob, friendCharlie
    // Suppose currentUser wants to add known contacts to group-b:
    // Available known contacts: friendBob, friendCharlie
    // After excluding existing members of group-b, none of them should remain
    const targetGroupMembers = membersGroupB;
    const allKnown = [friendBob, friendCharlie];

    const candidates = allKnown.filter(
      (c) => !targetGroupMembers.some((m) => m.user_id === c.id)
    );

    expect(candidates.length).toBe(0);

    // Now consider target group-a (has currentUser, friendBob, bannedUser):
    // Charlie is not in group-a, so Charlie should be a candidate!
    const candidatesForGroupA = allKnown.filter(
      (c) => !membersGroupA.some((m) => m.user_id === c.id)
    );

    expect(candidatesForGroupA.length).toBe(1);
    expect(candidatesForGroupA[0].id).toBe('user-charlie');
  });

  it('enforces group administrator permissions for direct member insertion', () => {
    // In group-a, currentUser is created_by and has role admin
    expect(isGroupAdmin(groupTripA.id, currentUser, groupTripA, membersGroupA)).toBe(true);

    // In group-b, currentUser is just a regular member and not creator
    expect(isGroupAdmin(groupDinnerB.id, currentUser, groupDinnerB, membersGroupB)).toBe(false);

    // Bob is just a regular member in group-a
    expect(isGroupAdmin(groupTripA.id, friendBob, groupTripA, membersGroupA)).toBe(false);

    // Superadmin has group admin rights everywhere
    const superAdmin: Profile = { ...currentUser, role: 'admin' };
    expect(isGroupAdmin(groupDinnerB.id, superAdmin, groupDinnerB, membersGroupB)).toBe(true);
  });
});
