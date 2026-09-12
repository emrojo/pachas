import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as postgresDb from '@/lib/db/postgres';

describe('Admin Metrics API (/api/admin/metrics)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies access (403) when user is not an administrator', async () => {
    const req = new NextRequest('http://localhost/api/admin/metrics', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Acceso denegado');
  });

  it('returns usersList with provisional name and is_unclaimed flag for unclaimed members', async () => {
    const mockUsers = [
      {
        id: 'admin-1',
        full_name: 'Super Admin',
        email: 'admin@pachas.app',
        role: 'admin',
        bizum_phone: '+34600000001',
        avatar_url: null,
        is_banned: false,
        banned_at: null,
        ban_reason: null,
        is_unclaimed: false,
        provisional_name: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'prov-user-123',
        full_name: 'Lucas CreadoAMano',
        email: 'unclaimed-12345678@pachas.local',
        role: 'member',
        bizum_phone: null,
        avatar_url: null,
        is_banned: false,
        banned_at: null,
        ban_reason: null,
        is_unclaimed: true,
        provisional_name: 'Lucas CreadoAMano',
        created_at: new Date().toISOString(),
      },
    ];

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('UPDATE public.profiles p')) {
          return Promise.resolve({ rowCount: 1 });
        }
        if (sql.includes('FROM public.profiles p')) {
          return Promise.resolve({ rows: mockUsers });
        }
        if (sql.includes('FROM public.groups')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM public.expenses')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM public.settlements')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM public.push_subscriptions')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM public.reports')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    vi.spyOn(postgresDb, 'getDbPool').mockReturnValue(mockPool as any);
    vi.spyOn(postgresDb, 'ensureGlobalSchema').mockResolvedValue(undefined as any);

    const req = new NextRequest('http://localhost/api/admin/metrics', {
      method: 'GET',
      headers: {
        cookie: `pachas_demo_user=${encodeURIComponent(
          JSON.stringify({ id: 'admin-1', email: 'admin@pachas.app', role: 'admin' })
        )}`,
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.usersList).toBeDefined();
    expect(data.usersList.length).toBe(2);

    const provUser = data.usersList.find((u: any) => u.id === 'prov-user-123');
    expect(provUser).toBeDefined();
    expect(provUser.full_name).toBe('Lucas CreadoAMano');
    expect(provUser.is_unclaimed).toBe(true);
    expect(provUser.provisional_name).toBe('Lucas CreadoAMano');
  });
});
