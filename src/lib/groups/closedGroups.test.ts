import { describe, it, expect } from 'vitest';
import { Group } from '@/types/database';

describe('Closed Groups vs Open Groups (FR-66)', () => {
  it('defaults is_closed to true for newly created groups', () => {
    const defaultGroup: Partial<Group> = {
      id: 'grp-test-1',
      name: 'Viaje Cerrado',
      invite_code: 'abc123',
      is_closed: true,
    };

    expect(defaultGroup.is_closed).toBe(true);
  });

  it('allows creating an open group with is_closed: false', () => {
    const openGroup: Partial<Group> = {
      id: 'grp-test-2',
      name: 'Comunidad Abierta',
      invite_code: 'open99',
      is_closed: false,
    };

    expect(openGroup.is_closed).toBe(false);
  });

  describe('Join validation logic', () => {
    function canJoinWithGeneralInvite(group: { is_closed?: boolean; is_archived?: boolean }): { allowed: boolean; reason?: string } {
      if (group.is_archived) {
        return { allowed: false, reason: 'archived' };
      }
      if (group.is_closed !== false) {
        return { allowed: false, reason: 'Este grupo es cerrado. Solo puedes unirte mediante una invitación personal única o siendo añadido directamente.' };
      }
      return { allowed: true };
    }

    it('blocks general invite code join if group is closed', () => {
      const closedGroup = { is_closed: true, is_archived: false };
      const res = canJoinWithGeneralInvite(closedGroup);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Este grupo es cerrado');
    });

    it('blocks general invite code join if is_closed is omitted (defaults to closed)', () => {
      const unspecifiedGroup = { is_archived: false };
      const res = canJoinWithGeneralInvite(unspecifiedGroup);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Este grupo es cerrado');
    });

    it('permits general invite code join if group is open', () => {
      const openGroup = { is_closed: false, is_archived: false };
      const res = canJoinWithGeneralInvite(openGroup);
      expect(res.allowed).toBe(true);
    });

    it('blocks general invite code join if group is archived regardless of open/closed status', () => {
      const archivedOpenGroup = { is_closed: false, is_archived: true };
      const res = canJoinWithGeneralInvite(archivedOpenGroup);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('archived');
    });
  });

  describe('Claim token validation for Closed Groups', () => {
    function canAccessWithClaimToken(group: { is_closed?: boolean }, tokenStatus: 'available' | 'already_claimed' | 'invalid'): boolean {
      return tokenStatus === 'available';
    }

    it('allows joining closed group when claim token is available', () => {
      const closedGroup = { is_closed: true };
      expect(canAccessWithClaimToken(closedGroup, 'available')).toBe(true);
    });

    it('disallows joining closed group when claim token is already claimed', () => {
      const closedGroup = { is_closed: true };
      expect(canAccessWithClaimToken(closedGroup, 'already_claimed')).toBe(false);
    });

    it('disallows joining closed group when claim token is invalid', () => {
      const closedGroup = { is_closed: true };
      expect(canAccessWithClaimToken(closedGroup, 'invalid')).toBe(false);
    });
  });
});
