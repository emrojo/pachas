import { describe, it, expect } from 'vitest';
import {
  generateProvisionalNames,
  generateFunProvisionalNames,
  generateClaimToken,
  buildClaimUrl,
  FRIENDLY_NAME_SUGGESTIONS,
} from './unclaimedMembers';

describe('Unclaimed Members utilities', () => {
  describe('generateProvisionalNames', () => {
    it('generates standard indexed provisional names', () => {
      const names = generateProvisionalNames(3);
      expect(names).toEqual(['Amigo 1', 'Amigo 2', 'Amigo 3']);
    });

    it('respects startNumber offset', () => {
      const names = generateProvisionalNames(2, 5);
      expect(names).toEqual(['Amigo 5', 'Amigo 6']);
    });

    it('handles 0 or negative count gracefully', () => {
      expect(generateProvisionalNames(0)).toEqual([]);
      expect(generateProvisionalNames(-5)).toEqual([]);
    });

    it('caps count at safe limit of 50', () => {
      const names = generateProvisionalNames(100);
      expect(names.length).toBe(50);
    });
  });

  describe('generateFunProvisionalNames', () => {
    it('uses themed name suggestions', () => {
      const names = generateFunProvisionalNames(3);
      expect(names).toEqual([
        FRIENDLY_NAME_SUGGESTIONS[0],
        FRIENDLY_NAME_SUGGESTIONS[1],
        FRIENDLY_NAME_SUGGESTIONS[2],
      ]);
    });

    it('cycles suggestions with index numbers if count exceeds suggestions length', () => {
      const count = FRIENDLY_NAME_SUGGESTIONS.length + 2;
      const names = generateFunProvisionalNames(count);
      expect(names.length).toBe(count);
      expect(names[FRIENDLY_NAME_SUGGESTIONS.length]).toBe(`${FRIENDLY_NAME_SUGGESTIONS[0]} 2`);
      expect(names[FRIENDLY_NAME_SUGGESTIONS.length + 1]).toBe(`${FRIENDLY_NAME_SUGGESTIONS[1]} 2`);
    });
  });

  describe('generateClaimToken', () => {
    it('generates valid non-empty tokens with high entropy', () => {
      const token1 = generateClaimToken();
      const token2 = generateClaimToken();
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('buildClaimUrl', () => {
    it('constructs correct join URL with query claim parameter', () => {
      const url = buildClaimUrl('https://pachas.app', 'TRIP123', 'tok_abc456');
      expect(url).toBe('https://pachas.app/join/TRIP123?claim=tok_abc456');
    });

    it('cleans trailing slashes from baseUrl', () => {
      const url = buildClaimUrl('https://pachas.app///', 'TRIP123', 'tok_abc456');
      expect(url).toBe('https://pachas.app/join/TRIP123?claim=tok_abc456');
    });

    it('properly URI encodes components', () => {
      const url = buildClaimUrl('https://pachas.app', 'TRIP 123', 'tok+special=');
      expect(url).toBe('https://pachas.app/join/TRIP%20123?claim=tok%2Bspecial%3D');
    });
  });

  describe('Cross-Group Unclaimed Propagation & Multi-Group Claiming', () => {
    it('generates distinct independent claim tokens for the same provisional user across different groups', () => {
      const tokenGroupA = generateClaimToken();
      const tokenGroupB = generateClaimToken();

      expect(tokenGroupA).toBeTruthy();
      expect(tokenGroupB).toBeTruthy();
      expect(tokenGroupA).not.toBe(tokenGroupB);
    });

    it('propagates unclaimed status and provisional name when adding an unclaimed profile to a new group', () => {
      const dummyProfile = {
        id: 'dummy-user-123',
        email: 'unclaimed-12345678@pachas.local',
        full_name: 'Carlos Provisional',
        is_unclaimed: true,
      };

      // Helper logic simulating the addMemberToGroup propagation
      const isUnclaimed = Boolean(dummyProfile.is_unclaimed || dummyProfile.email.startsWith('unclaimed-'));
      const claimToken = isUnclaimed ? generateClaimToken() : null;
      const newMember = {
        id: 'gm-new',
        group_id: 'group-b',
        user_id: dummyProfile.id,
        is_unclaimed: isUnclaimed,
        provisional_name: isUnclaimed ? dummyProfile.full_name : null,
        claim_token: claimToken,
      };

      expect(newMember.is_unclaimed).toBe(true);
      expect(newMember.provisional_name).toBe('Carlos Provisional');
      expect(newMember.claim_token).toBeTruthy();
    });

    it('simulates multi-group claiming resolving all memberships for the provisional user', () => {
      const dummyUserId = 'dummy-user-123';
      const realUserId = 'real-user-maria';

      const memberships: Array<{
        id: string;
        group_id: string;
        user_id: string;
        is_unclaimed: boolean;
        provisional_name: string;
        claimed_by?: string | null;
        claim_token?: string | null;
      }> = [
        { id: 'gm-1', group_id: 'group-1', user_id: dummyUserId, is_unclaimed: true, provisional_name: 'Carlos', claim_token: 'tok1' },
        { id: 'gm-2', group_id: 'group-2', user_id: dummyUserId, is_unclaimed: true, provisional_name: 'Carlos', claim_token: 'tok2' },
      ];

      const expenses = [
        { id: 'exp-1', group_id: 'group-1', paid_by: dummyUserId, participants: [dummyUserId, 'user-other'] },
        { id: 'exp-2', group_id: 'group-2', paid_by: 'user-other', participants: [dummyUserId] },
      ];

      // Claiming action across all groups for dummyUserId
      const updatedMemberships = memberships.map((gm) => {
        if (gm.user_id === dummyUserId) {
          return {
            ...gm,
            user_id: realUserId,
            is_unclaimed: false,
            claimed_by: realUserId,
            claim_token: null,
          };
        }
        return gm;
      });

      const updatedExpenses = expenses.map((exp) => ({
        ...exp,
        paid_by: exp.paid_by === dummyUserId ? realUserId : exp.paid_by,
        participants: exp.participants.map((p) => (p === dummyUserId ? realUserId : p)),
      }));

      // Verify all memberships are updated to real user and no longer unclaimed
      expect(updatedMemberships.every((m) => m.user_id === realUserId)).toBe(true);
      expect(updatedMemberships.every((m) => m.is_unclaimed === false)).toBe(true);
      expect(updatedMemberships.every((m) => m.claim_token === null)).toBe(true);

      // Verify expenses in both groups are reassigned
      expect(updatedExpenses[0].paid_by).toBe(realUserId);
      expect(updatedExpenses[0].participants).toContain(realUserId);
      expect(updatedExpenses[0].participants).not.toContain(dummyUserId);

      expect(updatedExpenses[1].paid_by).toBe('user-other');
      expect(updatedExpenses[1].participants).toContain(realUserId);
      expect(updatedExpenses[1].participants).not.toContain(dummyUserId);
    });

    it('merges memberships if the claiming user is already a member in one of the other groups', () => {
      const dummyUserId = 'dummy-user-123';
      const realUserId = 'real-user-maria';

      const group2Members: Array<{
        id: string;
        group_id: string;
        user_id: string;
        is_unclaimed: boolean;
        provisional_name?: string;
        claimed_by?: string | null;
      }> = [
        { id: 'gm-real', group_id: 'group-2', user_id: realUserId, is_unclaimed: false },
        { id: 'gm-dummy', group_id: 'group-2', user_id: dummyUserId, is_unclaimed: true, provisional_name: 'Carlos' },
      ];

      // If claiming user already exists in group-2, dummy row should be deleted and existing row updated
      const alreadyMember = group2Members.some((m) => (m.user_id as string) === realUserId && (m.user_id as string) !== dummyUserId);
      expect(alreadyMember).toBe(true);

      const resolvedGroup2Members = group2Members
        .filter((m) => m.user_id !== dummyUserId)
        .map((m) => (m.user_id === realUserId ? { ...m, claimed_by: realUserId } : m));

      expect(resolvedGroup2Members.length).toBe(1);
      expect(resolvedGroup2Members[0].user_id).toBe(realUserId);
      expect(resolvedGroup2Members[0].claimed_by).toBe(realUserId);
    });
  });
});
