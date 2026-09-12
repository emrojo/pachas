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
});
