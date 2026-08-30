import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isServerAdmin } from '@/lib/auth/adminAuth';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  role: 'admin' | 'member';
  isAdmin: boolean;
  isBanned: boolean;
  banReason?: string;
}

export interface UserAuthResult {
  user: AuthenticatedUser | null;
  isBanned: boolean;
  banReason?: string;
  errorResponse: NextResponse | null;
}

/**
 * Validates the user session and enforces account ban lockout in server-side API routes.
 * 
 * @param request NextRequest
 * @param options.allowBanned If true, permits banned users (e.g. for support chat / appeals)
 * @param options.requireAdmin If true, enforces administrator role
 */
export async function requireActiveUser(
  request: NextRequest,
  options?: { allowBanned?: boolean; requireAdmin?: boolean }
): Promise<UserAuthResult> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  let userId: string | undefined;
  let userEmail: string | undefined;
  let userRole: 'admin' | 'member' = 'member';

  // 1. Try JWT verification
  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      userId = payload.sub;
      userEmail = payload.email;
      userRole = (payload.role === 'admin' || isServerAdmin(payload.email, payload.sub, payload.role)) ? 'admin' : 'member';
    }
  }

  // 2. Try Demo User Cookie (fallback)
  if (!userId) {
    const demoCookie = request.cookies.get('pachas_demo_user')?.value;
    if (demoCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(demoCookie));
        if (parsed?.id) {
          userId = parsed.id;
          userEmail = parsed.email;
          userRole = (parsed.role === 'admin' || isServerAdmin(parsed.email, parsed.id, parsed.role)) ? 'admin' : 'member';
        }
      } catch {}
    }
  }

  // If completely unauthenticated
  if (!userId) {
    return {
      user: null,
      isBanned: false,
      errorResponse: NextResponse.json(
        { error: 'No autenticado. Inicia sesión para continuar.' },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      ),
    };
  }

  // 3. Verify Ban Status in PostgreSQL Database
  let isBanned = false;
  let banReason: string | undefined;

  const pool = getDbPool();
  if (pool) {
    try {
      const uRes = await pool.query(
        `SELECT role, COALESCE(is_banned, FALSE) AS is_banned, ban_reason 
         FROM public.profiles 
         WHERE id::text = $1::text`,
        [userId]
      );
      if (uRes.rows.length > 0) {
        const row = uRes.rows[0];
        isBanned = Boolean(row.is_banned);
        banReason = row.ban_reason || undefined;
        if (row.role === 'admin' || isServerAdmin(userEmail, userId, row.role)) {
          userRole = 'admin';
        }
      }
    } catch {
      // If table/column is in process of migrating, proceed safely
    }
  }

  const isAdmin = userRole === 'admin';

  // 4. If user is banned and this endpoint does NOT permit banned users
  if (isBanned && !options?.allowBanned) {
    return {
      user: null,
      isBanned: true,
      banReason,
      errorResponse: NextResponse.json(
        {
          error: 'Tu cuenta se encuentra suspendida por moderación.',
          is_banned: true,
          ban_reason: banReason || 'Infracción de las normas de la comunidad',
          suspended_redirect_url: '/suspended',
        },
        {
          status: 403,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      ),
    };
  }

  // 5. If admin role is required
  if (options?.requireAdmin && !isAdmin) {
    return {
      user: null,
      isBanned,
      errorResponse: NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador.' },
        {
          status: 403,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      ),
    };
  }

  return {
    user: {
      userId,
      email: userEmail,
      role: userRole,
      isAdmin,
      isBanned,
      banReason,
    },
    isBanned,
    banReason,
    errorResponse: null,
  };
}
