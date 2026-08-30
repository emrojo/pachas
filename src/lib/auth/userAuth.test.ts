import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { requireActiveUser } from './userAuth';
import * as jwtMod from '@/lib/auth/jwt';
import * as dbMod from '@/lib/db/postgres';

describe('requireActiveUser Authentication & Ban Enforcement Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/groups', {
      headers: {},
    });

    const result = await requireActiveUser(req);
    expect(result.user).toBeNull();
    expect(result.errorResponse).not.toBeNull();
    expect(result.errorResponse?.status).toBe(401);
  });

  it('allows active non-banned users with HTTP 200/null error response', async () => {
    vi.spyOn(jwtMod, 'verifyJwt').mockResolvedValue({
      sub: 'user-active-123',
      email: 'active@example.com',
      role: 'member',
    } as any);

    vi.spyOn(dbMod, 'getDbPool').mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [{ role: 'member', is_banned: false, ban_reason: null }],
      }),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/groups', {
      headers: {
        authorization: 'Bearer valid-jwt-token',
      },
    });

    const result = await requireActiveUser(req);
    expect(result.errorResponse).toBeNull();
    expect(result.user?.userId).toBe('user-active-123');
    expect(result.isBanned).toBe(false);
  });

  it('strictly blocks banned users with HTTP 403 and suspended_redirect_url', async () => {
    vi.spyOn(jwtMod, 'verifyJwt').mockResolvedValue({
      sub: 'user-banned-456',
      email: 'banned@example.com',
      role: 'member',
    } as any);

    vi.spyOn(dbMod, 'getDbPool').mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [{ role: 'member', is_banned: true, ban_reason: 'Reporte de gasto fraudulento' }],
      }),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/expenses', {
      headers: {
        authorization: 'Bearer banned-jwt-token',
      },
    });

    const result = await requireActiveUser(req);
    expect(result.user).toBeNull();
    expect(result.isBanned).toBe(true);
    expect(result.errorResponse).not.toBeNull();
    expect(result.errorResponse?.status).toBe(403);

    const body = await result.errorResponse?.json();
    expect(body.is_banned).toBe(true);
    expect(body.suspended_redirect_url).toBe('/suspended');
    expect(body.ban_reason).toBe('Reporte de gasto fraudulento');
  });

  it('permits banned users when allowBanned option is true (for support/appeals)', async () => {
    vi.spyOn(jwtMod, 'verifyJwt').mockResolvedValue({
      sub: 'user-banned-456',
      email: 'banned@example.com',
      role: 'member',
    } as any);

    vi.spyOn(dbMod, 'getDbPool').mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [{ role: 'member', is_banned: true, ban_reason: 'Conducta inapropiada' }],
      }),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/support/messages', {
      headers: {
        authorization: 'Bearer banned-jwt-token',
      },
    });

    const result = await requireActiveUser(req, { allowBanned: true });
    expect(result.errorResponse).toBeNull();
    expect(result.user?.userId).toBe('user-banned-456');
    expect(result.isBanned).toBe(true);
  });

  it('enforces admin role requirement when requireAdmin is true', async () => {
    vi.spyOn(jwtMod, 'verifyJwt').mockResolvedValue({
      sub: 'user-member-789',
      email: 'regular@example.com',
      role: 'member',
    } as any);

    vi.spyOn(dbMod, 'getDbPool').mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [{ role: 'member', is_banned: false }],
      }),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/reports', {
      headers: {
        authorization: 'Bearer regular-jwt-token',
      },
    });

    const result = await requireActiveUser(req, { requireAdmin: true });
    expect(result.user).toBeNull();
    expect(result.errorResponse?.status).toBe(403);
  });
});
