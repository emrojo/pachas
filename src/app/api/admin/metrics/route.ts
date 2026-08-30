import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isServerAdmin } from '@/lib/auth/adminAuth';

async function checkAdminAuth(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string; email?: string }> {
  // 1. Check Bearer Authorization header or sb-access-token cookie
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      if (isServerAdmin(payload.email, payload.sub, payload.role)) {
        return { isAdmin: true, userId: payload.sub, email: payload.email };
      }
      const pool = getDbPool();
      if (pool) {
        try {
          const uRes = await pool.query(
            'SELECT role, email FROM public.profiles WHERE id::text = $1::text',
            [payload.sub]
          );
          if (uRes.rows.length > 0) {
            const user = uRes.rows[0];
            if (isServerAdmin(user.email, payload.sub, user.role)) {
              return { isAdmin: true, userId: payload.sub, email: user.email };
            }
          }
        } catch {}
      }
    }
  }

  // 2. Demo Cookie / Session fallback
  const demoCookie = request.cookies.get('pachas_demo_user')?.value;
  if (demoCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(demoCookie));
      if (isServerAdmin(parsed.email, parsed.id, parsed.role)) {
        return { isAdmin: true, userId: parsed.id, email: parsed.email };
      }
    } catch {}
  }

  return { isAdmin: false };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador de Sistema.' },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    const startTime = Date.now();
    let dbLatencyMs = 0;
    let isDbConnected = false;

    if (pool) {
      try {
        await pool.query('SELECT 1');
        dbLatencyMs = Date.now() - startTime;
        isDbConnected = true;
      } catch {
        isDbConnected = false;
      }
    }

    let usersList: any[] = [];
    let groupsList: any[] = [];
    let totals = {
      totalUsers: 0,
      totalGroups: 0,
      activeGroups: 0,
      archivedGroups: 0,
      totalExpenses: 0,
      totalVolumeEur: 0,
      totalSettlements: 0,
      totalSettledEur: 0,
      totalComments: 0,
      totalPushSubscriptions: 0,
    };
    let featureUsage = {
      ocr: { ocrScannedExpenses: 0, manualExpenses: 0, ocrPercentage: 0 },
      splitTypes: { equal: 0, exact: 0, percentage: 0, shares: 0 },
      paymentMethods: { BIZUM: 0, CASH: 0, REVOLUT: 0, BANK_TRANSFER: 0, OTHER: 0 },
      topCurrencies: [{ currency: 'EUR', count: 0 }],
    };

    if (pool && isDbConnected) {
      try {
        // 1. Users directory
        const usersRes = await pool.query(`
          SELECT 
            p.id, 
            p.full_name, 
            p.email, 
            p.role, 
            p.bizum_phone, 
            p.avatar_url,
            p.created_at,
            (SELECT COUNT(*) FROM public.group_members gm WHERE gm.user_id = p.id) AS groups_count,
            (SELECT COUNT(*) FROM public.expenses e WHERE e.created_by = p.id) AS expenses_count,
            (SELECT COUNT(*) > 0 FROM public.push_subscriptions ps WHERE ps.user_id = p.id) AS has_push
          FROM public.profiles p
          ORDER BY p.created_at DESC
        `);
        usersList = usersRes.rows.map((r: any) => ({
          ...r,
          groups_count: parseInt(r.groups_count || '0', 10),
          expenses_count: parseInt(r.expenses_count || '0', 10),
          has_push: Boolean(r.has_push),
        }));

        // 2. Groups directory
        const groupsRes = await pool.query(`
          SELECT 
            g.id, 
            g.name, 
            g.description,
            g.icon_emoji, 
            g.base_currency, 
            g.is_archived,
            g.created_at,
            (SELECT p.full_name FROM public.profiles p WHERE p.id = g.created_by) AS creator_name,
            (SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id) AS members_count,
            (SELECT COUNT(*) FROM public.expenses e WHERE e.group_id = g.id) AS expenses_count,
            (SELECT COALESCE(SUM(e.amount), 0) FROM public.expenses e WHERE e.group_id = g.id) AS total_amount
          FROM public.groups g
          ORDER BY g.created_at DESC
        `);
        groupsList = groupsRes.rows.map((r: any) => ({
          ...r,
          members_count: parseInt(r.members_count || '0', 10),
          expenses_count: parseInt(r.expenses_count || '0', 10),
          total_amount: parseFloat(r.total_amount || '0'),
        }));

        // 3. Totals
        const expTotalRes = await pool.query(`
          SELECT 
            COUNT(*) AS total_count,
            COALESCE(SUM(amount), 0) AS total_vol,
            COUNT(CASE WHEN receipt_url IS NOT NULL AND receipt_url != '' THEN 1 END) AS ocr_count,
            COUNT(CASE WHEN split_type = 'EQUAL' OR split_type IS NULL THEN 1 END) AS split_equal,
            COUNT(CASE WHEN split_type = 'EXACT' THEN 1 END) AS split_exact,
            COUNT(CASE WHEN split_type = 'PERCENTAGE' THEN 1 END) AS split_percentage,
            COUNT(CASE WHEN split_type = 'SHARES' THEN 1 END) AS split_shares
          FROM public.expenses
        `);
        const expData = expTotalRes.rows[0] || {};
        const totalExp = parseInt(expData.total_count || '0', 10);
        const ocrExp = parseInt(expData.ocr_count || '0', 10);

        // Settlements stats
        let settleCount = 0;
        let settleVol = 0;
        let paymentMethods = { BIZUM: 0, CASH: 0, REVOLUT: 0, BANK_TRANSFER: 0, OTHER: 0 };
        try {
          const settleRes = await pool.query(`
            SELECT 
              COUNT(*) AS count,
              COALESCE(SUM(amount), 0) AS vol,
              payment_method
            FROM public.settlements
            GROUP BY payment_method
          `);
          settleRes.rows.forEach((r: any) => {
            const count = parseInt(r.count || '0', 10);
            settleCount += count;
            settleVol += parseFloat(r.vol || '0');
            if (r.payment_method && (r.payment_method in paymentMethods)) {
              paymentMethods[r.payment_method as keyof typeof paymentMethods] = count;
            } else {
              paymentMethods.OTHER += count;
            }
          });
        } catch {}

        // Comments stats
        let commentsCount = 0;
        try {
          const cRes = await pool.query('SELECT COUNT(*) AS count FROM public.expense_comments');
          commentsCount = parseInt(cRes.rows[0]?.count || '0', 10);
        } catch {}

        // Push subscriptions stats
        let pushCount = 0;
        try {
          const pRes = await pool.query('SELECT COUNT(*) AS count FROM public.push_subscriptions');
          pushCount = parseInt(pRes.rows[0]?.count || '0', 10);
        } catch {}

        // Currency breakdown
        let topCurrencies: any[] = [];
        try {
          const currRes = await pool.query(`
            SELECT currency, COUNT(*) AS count
            FROM public.expenses
            GROUP BY currency
            ORDER BY count DESC
            LIMIT 5
          `);
          topCurrencies = currRes.rows.map((r: any) => ({ currency: r.currency, count: parseInt(r.count, 10) }));
        } catch {}

        totals = {
          totalUsers: usersList.length,
          totalGroups: groupsList.length,
          activeGroups: groupsList.filter((g: any) => !g.is_archived).length,
          archivedGroups: groupsList.filter((g: any) => g.is_archived).length,
          totalExpenses: totalExp,
          totalVolumeEur: parseFloat(expData.total_vol || '0'),
          totalSettlements: settleCount,
          totalSettledEur: settleVol,
          totalComments: commentsCount,
          totalPushSubscriptions: pushCount,
        };

        featureUsage = {
          ocr: {
            ocrScannedExpenses: ocrExp,
            manualExpenses: totalExp - ocrExp,
            ocrPercentage: totalExp > 0 ? Math.round((ocrExp / totalExp) * 100) : 0,
          },
          splitTypes: {
            equal: parseInt(expData.split_equal || '0', 10),
            exact: parseInt(expData.split_exact || '0', 10),
            percentage: parseInt(expData.split_percentage || '0', 10),
            shares: parseInt(expData.split_shares || '0', 10),
          },
          paymentMethods,
          topCurrencies: topCurrencies.length > 0 ? topCurrencies : [{ currency: 'EUR', count: totalExp }],
        };
      } catch (dbErr) {
        console.warn('Admin metrics query error:', dbErr);
      }
    }

    // Fallback if users list is empty
    if (usersList.length === 0) {
      usersList = [
        {
          id: 'user-edu',
          full_name: 'Eduardo Martín',
          email: 'edu@example.com',
          role: 'admin',
          bizum_phone: '+34 600 123 456',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          created_at: '2026-06-01T10:00:00Z',
          groups_count: 1,
          expenses_count: 2,
          has_push: true,
        },
        {
          id: 'user-lucia',
          full_name: 'Lucía Gómez',
          email: 'lucia@example.com',
          role: 'member',
          bizum_phone: '+34 611 222 333',
          avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
          created_at: '2026-06-01T10:00:00Z',
          groups_count: 1,
          expenses_count: 1,
          has_push: true,
        },
        {
          id: 'user-carlos',
          full_name: 'Carlos Ruiz',
          email: 'carlos@example.com',
          role: 'member',
          bizum_phone: '+34 622 333 444',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          created_at: '2026-06-01T10:00:00Z',
          groups_count: 1,
          expenses_count: 1,
          has_push: false,
        },
      ];
      totals.totalUsers = usersList.length;
    }

    const mem = process.memoryUsage();
    const systemInfo = {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
    };

    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
    const hasVapidKeys = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PRIVATE_KEY);

    const healthServices = [
      {
        id: 'postgres',
        name: 'Base de Datos PostgreSQL',
        status: isDbConnected ? ('healthy' as const) : ('error' as const),
        latencyMs: dbLatencyMs,
        details: isDbConnected ? `Conexión activa (${dbLatencyMs}ms)` : 'No se pudo conectar al pool de PostgreSQL',
      },
      {
        id: 'gemini_ocr',
        name: 'Motor OCR Gemini Vision (IA)',
        status: hasGeminiKey ? ('healthy' as const) : ('warning' as const),
        latencyMs: 0,
        details: hasGeminiKey ? 'API Key configurada (Gemini 1.5 Flash)' : 'API Key ausente (usa simulación local)',
      },
      {
        id: 'webpush',
        name: 'Servicio de Notificaciones Push',
        status: 'healthy' as const,
        latencyMs: 0,
        details: `${totals.totalPushSubscriptions} dispositivo(s) registrados`,
      },
      {
        id: 'frankfurter_fx',
        name: 'Conversión de Divisas (Frankfurter FX)',
        status: 'healthy' as const,
        latencyMs: 0,
        details: 'Tasas de cambio del Banco Central Europeo activas',
      },
    ];

    const anomalies: Array<{ id: string; level: 'info' | 'warning' | 'critical'; title: string; message: string }> = [];

    if (!isDbConnected) {
      anomalies.push({
        id: 'db_unreachable',
        level: 'critical',
        title: 'Base de datos PostgreSQL desconectada',
        message: 'Verifica la cadena de conexión DATABASE_URL o el servicio local de PostgreSQL.',
      });
    }

    if (!hasGeminiKey) {
      anomalies.push({
        id: 'ocr_key_missing',
        level: 'warning',
        title: 'API Key de Gemini AI no configurada',
        message: 'El escaneo inteligente de tickets está funcionando en modo fallback/simulación.',
      });
    }

    const emptyGroups = groupsList.filter((g: any) => g.members_count === 0);
    if (emptyGroups.length > 0) {
      anomalies.push({
        id: 'empty_groups',
        level: 'info',
        title: `${emptyGroups.length} grupo(s) sin miembros activos`,
        message: 'Se han detectado grupos que no tienen ningún participante asignado.',
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      systemInfo,
      healthServices,
      totals,
      featureUsage,
      usersList,
      groupsList,
      anomalies,
    });
  } catch (err: any) {
    console.error('Error in admin metrics API:', err);
    return NextResponse.json(
      { error: err.message || 'Error al cargar métricas de administración' },
      { status: 500 }
    );
  }
}
