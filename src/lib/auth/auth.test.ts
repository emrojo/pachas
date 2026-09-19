import { describe, it, expect, afterEach } from 'vitest';
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

describe('Google Auth Configuration Endpoint (GET /api/auth/google)', () => {
  const originalNextPublic = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = originalNextPublic;
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  });

  it('returns enabled: false when no client ID is configured', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    const { GET } = await import('@/app/api/auth/google/route');
    const response = await GET();
    const data = await response.json();

    expect(data.enabled).toBe(false);
    expect(data.clientId).toBeNull();
  });

  it('returns enabled: true and clientId when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set', async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-public-client-id.apps.googleusercontent.com';
    delete process.env.GOOGLE_CLIENT_ID;

    const { GET } = await import('@/app/api/auth/google/route');
    const response = await GET();
    const data = await response.json();

    expect(data.enabled).toBe(true);
    expect(data.clientId).toBe('test-public-client-id.apps.googleusercontent.com');
  });

  it('falls back to GOOGLE_CLIENT_ID if NEXT_PUBLIC_GOOGLE_CLIENT_ID is empty', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'runtime-client-id.apps.googleusercontent.com';

    const { GET } = await import('@/app/api/auth/google/route');
    const response = await GET();
    const data = await response.json();

    expect(data.enabled).toBe(true);
    expect(data.clientId).toBe('runtime-client-id.apps.googleusercontent.com');
  });
});

