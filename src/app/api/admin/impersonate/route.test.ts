import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, DELETE, GET } from './route';
import * as postgresDb from '@/lib/db/postgres';
import { signJwt } from '@/lib/auth/jwt';

describe('Admin Impersonation API (/api/admin/impersonate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies access (403) on POST when requester is not an administrator', async () => {
    // Regular non-admin user token
    const token = await signJwt({
      sub: 'regular-user-1',
      email: 'user@pachas.com',
      role: 'member',
    });

    const req = new NextRequest('http://localhost/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `sb-access-token=${token}`,
      },
      body: JSON.stringify({ targetUserId: 'target-user-2' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Acceso denegado');
  });

  it('rejects POST with 400 if targetUserId is missing or is self', async () => {
    const adminToken = await signJwt({
      sub: 'admin-1',
      email: 'admin@pachas.local',
      role: 'admin',
    });

    // 1. Missing targetUserId
    const req1 = new NextRequest('http://localhost/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `sb-access-token=${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);

    // 2. Self impersonation
    const req2 = new NextRequest('http://localhost/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `sb-access-token=${adminToken}`,
      },
      body: JSON.stringify({ targetUserId: 'admin-1' }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
    const data2 = await res2.json();
    expect(data2.error).toContain('No puedes impersonarte a ti mismo');
  });

  it('successfully starts impersonation on POST for verified admin', async () => {
    const adminToken = await signJwt({
      sub: 'admin-1',
      email: 'admin@pachas.local',
      role: 'admin',
    });

    const targetUser = {
      id: 'target-member-99',
      email: 'carlos@pachas.com',
      full_name: 'Carlos Mendoza',
      avatar_url: 'https://avatar.url/carlos',
      role: 'member',
      created_at: new Date().toISOString(),
      is_banned: false,
    };

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM public.profiles')) {
          return Promise.resolve({ rows: [targetUser] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    vi.spyOn(postgresDb, 'getDbPool').mockReturnValue(mockPool as any);

    const req = new NextRequest('http://localhost/api/admin/impersonate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `sb-access-token=${adminToken}`,
      },
      body: JSON.stringify({ targetUserId: 'target-member-99' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.targetUser.id).toBe('target-member-99');
    expect(data.adminUser.id).toBe('admin-1');

    // Verify cookies set
    const sbCookie = res.cookies.get('sb-access-token');
    const impCookie = res.cookies.get('pachas_impersonator');
    expect(sbCookie).toBeDefined();
    expect(impCookie).toBeDefined();
  });

  it('exits impersonation on DELETE and restores admin session', async () => {
    const adminId = 'admin-1';
    const adminEmail = 'admin@pachas.local';

    const impCookieValue = encodeURIComponent(
      JSON.stringify({
        adminId,
        adminEmail,
        impersonatedAt: new Date().toISOString(),
      })
    );

    // Target user token currently active
    const targetToken = await signJwt({
      sub: 'target-member-99',
      email: 'carlos@pachas.com',
      role: 'member',
      impersonator_admin_id: adminId,
      impersonator_admin_email: adminEmail,
    });

    const adminProfile = {
      id: adminId,
      email: adminEmail,
      full_name: 'Admin Supremo',
      role: 'admin',
    };

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM public.profiles')) {
          return Promise.resolve({ rows: [adminProfile] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    vi.spyOn(postgresDb, 'getDbPool').mockReturnValue(mockPool as any);

    const req = new NextRequest('http://localhost/api/admin/impersonate', {
      method: 'DELETE',
      headers: {
        cookie: `sb-access-token=${targetToken}; pachas_impersonator=${impCookieValue}`,
      },
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe(adminId);
    expect(data.user.role).toBe('admin');

    // Impersonator cookie cleared
    const clearedImp = res.cookies.get('pachas_impersonator');
    expect(clearedImp?.value).toBe('');
  });

  it('reports impersonation status accurately on GET', async () => {
    // 1. Without impersonation cookie
    const req1 = new NextRequest('http://localhost/api/admin/impersonate', {
      method: 'GET',
    });
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.isImpersonating).toBe(false);

    // 2. With impersonation cookie
    const impCookieValue = encodeURIComponent(
      JSON.stringify({
        adminId: 'admin-1',
        adminEmail: 'admin@pachas.local',
        impersonatedAt: new Date().toISOString(),
      })
    );
    const req2 = new NextRequest('http://localhost/api/admin/impersonate', {
      method: 'GET',
      headers: {
        cookie: `pachas_impersonator=${impCookieValue}`,
      },
    });
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.isImpersonating).toBe(true);
    expect(data2.adminUser.id).toBe('admin-1');
  });
});
