import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from './route';
import * as postgresDb from '@/lib/db/postgres';

describe('Admin User Management API (/api/admin/users/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies access (403) when user is not an administrator', async () => {
    const req = new NextRequest('http://localhost/api/admin/users/user-123', {
      method: 'GET',
    });

    const response = await GET(req, {
      params: Promise.resolve({ id: 'user-123' }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Acceso denegado');
  });

  it('returns user details, groups, and all system groups for admin on GET', async () => {
    const mockUser = {
      id: 'target-user-1',
      email: 'target@pachas.com',
      full_name: 'Target User',
      bizum_phone: '+34600111222',
      avatar_url: 'https://avatar.url/1',
      role: 'member',
      preferred_language: 'es',
      is_banned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockGroups = [
      {
        id: 'group-1',
        name: 'Viaje a Roma',
        description: 'Vacaciones',
        icon_emoji: '✈️',
        base_currency: 'EUR',
        role: 'member',
        joined_at: new Date().toISOString(),
        is_unclaimed: false,
      },
    ];

    const mockAllGroups = [
      { id: 'group-1', name: 'Viaje a Roma', icon_emoji: '✈️', is_frozen: false },
      { id: 'group-2', name: 'Piso Compartido', icon_emoji: '🏠', is_frozen: false },
    ];

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM public.profiles')) {
          return Promise.resolve({ rows: [mockUser] });
        }
        if (sql.includes('FROM public.group_members')) {
          return Promise.resolve({ rows: mockGroups });
        }
        if (sql.includes('FROM public.groups')) {
          return Promise.resolve({ rows: mockAllGroups });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    vi.spyOn(postgresDb, 'getDbPool').mockReturnValue(mockPool as any);

    const req = new NextRequest('http://localhost/api/admin/users/target-user-1', {
      method: 'GET',
      headers: {
        cookie: `pachas_demo_user=${encodeURIComponent(JSON.stringify({ id: 'admin-1', email: 'admin@pachas.app', role: 'admin' }))}`,
      },
    });

    const response = await GET(req, {
      params: Promise.resolve({ id: 'target-user-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.email).toBe('target@pachas.com');
    expect(data.groups.length).toBe(1);
    expect(data.allGroups.length).toBe(2);
  });

  it('rejects PUT when email format is invalid', async () => {
    const req = new NextRequest('http://localhost/api/admin/users/target-user-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: `pachas_demo_user=${encodeURIComponent(JSON.stringify({ id: 'admin-1', email: 'admin@pachas.app', role: 'admin' }))}`,
      },
      body: JSON.stringify({
        fullName: 'Target User',
        email: 'invalid-email-format',
      }),
    });

    const response = await PUT(req, {
      params: Promise.resolve({ id: 'target-user-1' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('El correo electrónico no es válido.');
  });

  it('successfully updates user details on PUT', async () => {
    const updatedUser = {
      id: 'target-user-1',
      email: 'target@pachas.com',
      full_name: 'Updated Name',
      role: 'admin',
      bizum_phone: '+34666555444',
      preferred_language: 'es',
    };

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM public.profiles WHERE LOWER(email)')) {
          return Promise.resolve({ rows: [] }); // No conflict
        }
        if (sql.includes('UPDATE public.profiles')) {
          return Promise.resolve({ rows: [updatedUser] });
        }
        if (sql.includes('UPDATE auth.users')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    vi.spyOn(postgresDb, 'getDbPool').mockReturnValue(mockPool as any);

    const req = new NextRequest('http://localhost/api/admin/users/target-user-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: `pachas_demo_user=${encodeURIComponent(JSON.stringify({ id: 'admin-1', email: 'admin@pachas.app', role: 'admin' }))}`,
      },
      body: JSON.stringify({
        full_name: 'Updated Name',
        role: 'admin',
        bizum_phone: '+34666555444',
      }),
    });

    const response = await PUT(req, {
      params: Promise.resolve({ id: 'target-user-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.full_name).toBe('Updated Name');
    expect(data.user.role).toBe('admin');
  });

  it('returns provisional name and is_unclaimed: true for unclaimed provisional members', async () => {
    const mockUnclaimedUser = {
      id: 'prov-user-1',
      email: 'unclaimed-12345678@pachas.local',
      full_name: 'Lucas Provisional',
      bizum_phone: null,
      avatar_url: null,
      role: 'member',
      preferred_language: 'es',
      is_banned: false,
      is_unclaimed: true,
      provisional_name: 'Lucas Provisional',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockPool = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM public.profiles')) {
          return Promise.resolve({ rows: [mockUnclaimedUser] });
        }
        if (sql.includes('FROM public.group_members')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM public.groups')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };

    vi.spyOn(postgresDb, 'getDbPool').mockReturnValue(mockPool as any);

    const req = new NextRequest('http://localhost/api/admin/users/prov-user-1', {
      method: 'GET',
      headers: {
        cookie: `pachas_demo_user=${encodeURIComponent(JSON.stringify({ id: 'admin-1', email: 'admin@pachas.app', role: 'admin' }))}`,
      },
    });

    const response = await GET(req, {
      params: Promise.resolve({ id: 'prov-user-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.full_name).toBe('Lucas Provisional');
    expect(data.user.is_unclaimed).toBe(true);
    expect(data.user.email).toContain('unclaimed-');
  });
});
