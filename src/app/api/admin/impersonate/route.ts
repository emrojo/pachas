import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { signJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isServerAdmin } from '@/lib/auth/adminAuth';

const IMPERSONATOR_COOKIE_NAME = 'pachas_impersonator';

/**
 * POST /api/admin/impersonate
 * Starts impersonating a target user. Requires Application Admin permissions.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Enforce admin authentication
    const auth = await requireActiveUser(request, { requireAdmin: true });
    if (auth.errorResponse) {
      return auth.errorResponse;
    }
    const adminUser = auth.user!;

    // 2. Parse payload
    const body = await request.json().catch(() => ({}));
    const { targetUserId } = body;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json(
        { error: 'Debes especificar el ID del usuario a impersonar' },
        { status: 400 }
      );
    }

    if (targetUserId === adminUser.userId) {
      return NextResponse.json(
        { error: 'No puedes impersonarte a ti mismo' },
        { status: 400 }
      );
    }

    // 3. Query target user from database
    const pool = getDbPool();
    let targetProfile: any = null;

    if (pool) {
      try {
        const uRes = await pool.query(
          `SELECT id, email, full_name, avatar_url, bizum_phone, preferred_language, role, created_at,
                  COALESCE(is_banned, FALSE) AS is_banned, ban_reason
           FROM public.profiles
           WHERE id::text = $1::text
           LIMIT 1`,
          [targetUserId]
        );
        if (uRes.rows.length > 0) {
          targetProfile = uRes.rows[0];
        }
      } catch (dbErr) {
        console.warn('Database query error in impersonate:', dbErr);
      }
    }

    // Fallback if target user not found in DB
    if (!targetProfile) {
      return NextResponse.json(
        { error: 'El usuario especificado no existe' },
        { status: 404 }
      );
    }

    // 4. Create impersonation token for the target user
    const targetToken = await signJwt({
      sub: targetProfile.id,
      email: targetProfile.email || '',
      role: targetProfile.role || 'member',
      full_name: targetProfile.full_name || targetProfile.email?.split('@')[0] || 'Usuario',
      impersonator_admin_id: adminUser.userId,
      impersonator_admin_email: adminUser.email || '',
    });

    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');

    const adminInfo = {
      id: adminUser.userId,
      email: adminUser.email || '',
    };

    const response = NextResponse.json({
      success: true,
      targetUser: targetProfile,
      adminUser: adminInfo,
      message: `Impersonando a ${targetProfile.full_name || targetProfile.email}`,
    });

    // 5. Set session cookie for target user
    response.cookies.set('sb-access-token', targetToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // 6. Set impersonator tracking cookie
    const impersonatorData = JSON.stringify({
      adminId: adminUser.userId,
      adminEmail: adminUser.email || '',
      impersonatedAt: new Date().toISOString(),
    });

    response.cookies.set(IMPERSONATOR_COOKIE_NAME, encodeURIComponent(impersonatorData), {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // 7. Update demo cookie fallback
    response.cookies.set(
      'pachas_demo_user',
      encodeURIComponent(
        JSON.stringify({
          id: targetProfile.id,
          email: targetProfile.email,
          role: targetProfile.role || 'member',
        })
      ),
      {
        path: '/',
        maxAge: 60 * 60 * 24,
        sameSite: 'lax',
      }
    );

    return response;
  } catch (err: any) {
    console.error('Error starting impersonation:', err);
    return NextResponse.json(
      { error: err.message || 'Error al iniciar impersonación' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/impersonate
 * Exits impersonation mode and restores the original administrator session.
 */
export async function DELETE(request: NextRequest) {
  try {
    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');

    // 1. Read impersonator cookie or active JWT claim
    let adminId: string | undefined;
    let adminEmail: string | undefined;

    const impCookie = request.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value;
    if (impCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(impCookie));
        adminId = parsed.adminId;
        adminEmail = parsed.adminEmail;
      } catch {}
    }

    // If cookie not found, check current user's JWT impersonatedBy
    if (!adminId) {
      const activeAuth = await requireActiveUser(request);
      if (activeAuth.user?.impersonatedBy) {
        adminId = activeAuth.user.impersonatedBy.adminId;
        adminEmail = activeAuth.user.impersonatedBy.adminEmail;
      }
    }

    if (!adminId) {
      return NextResponse.json(
        { error: 'No hay ninguna sesión de impersonación activa' },
        { status: 400 }
      );
    }

    // 2. Fetch original admin profile
    const pool = getDbPool();
    let adminProfile: any = null;

    if (pool) {
      try {
        const aRes = await pool.query(
          `SELECT id, email, full_name, avatar_url, bizum_phone, preferred_language, role, created_at
           FROM public.profiles
           WHERE id::text = $1::text
           LIMIT 1`,
          [adminId]
        );
        if (aRes.rows.length > 0) {
          adminProfile = aRes.rows[0];
        }
      } catch (err) {
        console.warn('Database query error restoring admin:', err);
      }
    }

    if (!adminProfile) {
      adminProfile = {
        id: adminId,
        email: adminEmail || 'admin@pachas.local',
        full_name: 'Administrador',
        role: 'admin',
      };
    }

    // Verify admin privileges
    const isAdmin = isServerAdmin(adminProfile.email, adminProfile.id, adminProfile.role);
    if (!isAdmin && adminProfile.role !== 'admin') {
      return NextResponse.json(
        { error: 'El usuario original no cuenta con privilegios de Administrador' },
        { status: 403 }
      );
    }

    // 3. Sign new JWT restoring admin session
    const adminToken = await signJwt({
      sub: adminProfile.id,
      email: adminProfile.email,
      role: 'admin',
      full_name: adminProfile.full_name || adminProfile.email.split('@')[0],
    });

    const response = NextResponse.json({
      success: true,
      user: { ...adminProfile, role: 'admin' },
      message: 'Impersonación finalizada. Has vuelto a tu cuenta de administrador.',
    });

    // 4. Restore admin session cookie
    response.cookies.set('sb-access-token', adminToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // 5. Clear impersonator tracking cookie
    response.cookies.set(IMPERSONATOR_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    // 6. Restore demo cookie to admin
    response.cookies.set(
      'pachas_demo_user',
      encodeURIComponent(
        JSON.stringify({
          id: adminProfile.id,
          email: adminProfile.email,
          role: 'admin',
        })
      ),
      {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      }
    );

    return response;
  } catch (err: any) {
    console.error('Error stopping impersonation:', err);
    return NextResponse.json(
      { error: err.message || 'Error al salir de la impersonación' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/impersonate
 * Returns the current impersonation status and original admin details if active.
 */
export async function GET(request: NextRequest) {
  try {
    const impCookie = request.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value;
    if (impCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(impCookie));
        return NextResponse.json({
          isImpersonating: true,
          adminUser: {
            id: parsed.adminId,
            email: parsed.adminEmail,
            impersonatedAt: parsed.impersonatedAt,
          },
        });
      } catch {}
    }

    const activeAuth = await requireActiveUser(request);
    if (activeAuth.user?.impersonatedBy) {
      return NextResponse.json({
        isImpersonating: true,
        adminUser: {
          id: activeAuth.user.impersonatedBy.adminId,
          email: activeAuth.user.impersonatedBy.adminEmail,
        },
      });
    }

    return NextResponse.json({
      isImpersonating: false,
      adminUser: null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error checking impersonation status' },
      { status: 500 }
    );
  }
}
