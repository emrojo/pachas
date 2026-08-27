import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('Password Reset Logic', () => {
  it('generates a new valid password hash after reset', () => {
    const originalPass = 'OldPass123!';
    const originalHash = hashPassword(originalPass);

    const newPass = 'NewSecurePass2026!';
    const newHash = hashPassword(newPass);

    expect(verifyPassword(originalPass, originalHash)).toBe(true);
    expect(verifyPassword(newPass, originalHash)).toBe(false);

    expect(verifyPassword(newPass, newHash)).toBe(true);
    expect(verifyPassword(originalPass, newHash)).toBe(false);
  });
});
