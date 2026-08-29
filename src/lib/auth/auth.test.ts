import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { signJwt, verifyJwt } from './jwt';

describe('Password Hashing & Verification', () => {
  it('hashes password and verifies successfully', () => {
    const raw = 'SuperSecurePass123!';
    const hashed = hashPassword(raw);

    expect(hashed).toMatch(/^pbkdf2:[a-f0-9]+:[a-f0-9]+$/);
    expect(verifyPassword(raw, hashed)).toBe(true);
  });

  it('rejects incorrect password', () => {
    const raw = 'SuperSecurePass123!';
    const hashed = hashPassword(raw);

    expect(verifyPassword('WrongPass456!', hashed)).toBe(false);
  });

  it('supports direct seed password verification fallback', () => {
    expect(verifyPassword('myseedpass', 'myseedpass')).toBe(true);
    expect(verifyPassword('myseedpass', 'wrong')).toBe(false);
  });
});

describe('JWT Session Tokens', () => {
  it('signs and verifies JWT token', async () => {
    const payload = {
      sub: 'user-uuid-1234',
      email: 'test@pachas.local',
      role: 'admin',
      full_name: 'Test Admin',
    };

    const token = await signJwt(payload, 3600);
    expect(token.split('.').length).toBe(3);

    const verified = await verifyJwt(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.email).toBe(payload.email);
    expect(verified?.role).toBe(payload.role);
  });

  it('rejects tampered JWT token', async () => {
    const payload = {
      sub: 'user-uuid-1234',
      email: 'test@pachas.local',
    };

    const token = await signJwt(payload, 3600);
    const tampered = token.slice(0, -4) + 'abcd';

    expect(await verifyJwt(tampered)).toBeNull();
  });
});

