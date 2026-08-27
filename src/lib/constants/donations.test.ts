import { describe, it, expect } from 'vitest';
import { BUY_ME_A_COFFEE_URL, BUY_ME_A_COFFEE_USERNAME, DONATION_CONFIG } from './donations';

describe('Buy Me a Coffee Configuration', () => {
  it('has a valid default username and URL', () => {
    expect(BUY_ME_A_COFFEE_USERNAME).toBeDefined();
    expect(typeof BUY_ME_A_COFFEE_USERNAME).toBe('string');
    expect(BUY_ME_A_COFFEE_URL).toContain('buymeacoffee.com');
  });

  it('has valid donation options and coffee price', () => {
    expect(DONATION_CONFIG.coffeePrice).toBeGreaterThan(0);
    expect(DONATION_CONFIG.presetOptions.length).toBeGreaterThanOrEqual(3);
    expect(DONATION_CONFIG.presetOptions[0].amount).toBeDefined();
  });
});
