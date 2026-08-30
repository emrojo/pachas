import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isServerAdmin } from '@/lib/auth/adminAuth';

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      if (isServerAdmin(payload.email, payload.sub, payload.role)) return true;
      const pool = getDbPool();
      if (pool) {
        try {
          const uRes = await pool.query('SELECT role, email FROM public.profiles WHERE id::text = $1::text', [payload.sub]);
          if (uRes.rows.length > 0) {
            const user = uRes.rows[0];
            if (isServerAdmin(user.email, payload.sub, user.role)) return true;
          }
        } catch {}
      }
    }
  }

  const demoCookie = request.cookies.get('pachas_demo_user')?.value;
  if (demoCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(demoCookie));
      if (isServerAdmin(parsed.email, parsed.id, parsed.role)) return true;
    } catch {}
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const results: Array<{ id: string; name: string; status: 'healthy' | 'warning' | 'error'; latencyMs: number; details: string }> = [];

    // 1. Probe PostgreSQL
    const dbStart = Date.now();
    try {
      const pool = getDbPool();
      if (!pool) throw new Error('Pool no disponible');
      const res = await pool.query('SELECT NOW() as db_time');
      const latency = Date.now() - dbStart;
      results.push({
        id: 'postgres',
        name: 'Base de Datos PostgreSQL',
        status: 'healthy',
        latencyMs: latency,
        details: `Conexión correcta en ${latency}ms (Hora BD: ${new Date(res.rows[0].db_time).toLocaleTimeString()})`,
      });
    } catch (err: any) {
      results.push({
        id: 'postgres',
        name: 'Base de Datos PostgreSQL',
        status: 'error',
        latencyMs: Date.now() - dbStart,
        details: `Fallo de conexión: ${err.message}`,
      });
    }

    // 2. Probe Frankfurter FX API
    const fxStart = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const fxRes = await fetch('https://api.frankfurter.dev/v1/latest?symbols=USD', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - fxStart;
      if (fxRes.ok) {
        results.push({
          id: 'frankfurter_fx',
          name: 'API Tipos de Cambio (Frankfurter BCE)',
          status: 'healthy',
          latencyMs: latency,
          details: `Respuesta de tipos de cambio correcta en ${latency}ms`,
        });
      } else {
        results.push({
          id: 'frankfurter_fx',
          name: 'API Tipos de Cambio (Frankfurter BCE)',
          status: 'warning',
          latencyMs: latency,
          details: `Respuesta HTTP ${fxRes.status} (usando caché local)`,
        });
      }
    } catch (err: any) {
      results.push({
        id: 'frankfurter_fx',
        name: 'API Tipos de Cambio (Frankfurter BCE)',
        status: 'warning',
        latencyMs: Date.now() - fxStart,
        details: `Tiempo de espera agotado o error de red: ${err.message}`,
      });
    }

    // 3. Probe Gemini AI OCR Config
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
    results.push({
      id: 'gemini_ocr',
      name: 'Motor OCR Gemini Vision (IA)',
      status: hasGeminiKey ? 'healthy' : 'warning',
      latencyMs: 0,
      details: hasGeminiKey
        ? 'Clave API Gemini 1.5 Flash detectada y configurada en el entorno'
        : 'No se ha configurado GEMINI_API_KEY (funciona en modo simulación/fallback)',
    });

    // 4. Probe WebPush VAPID
    const hasVapid = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PRIVATE_KEY);
    results.push({
      id: 'webpush',
      name: 'Servicio WebPush (VAPID)',
      status: 'healthy',
      latencyMs: 0,
      details: hasVapid
        ? 'Claves VAPID configuradas para notificaciones push en navegador y móvil'
        : 'Claves VAPID por defecto activas para notificaciones locales',
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al ejecutar diagnóstico' }, { status: 500 });
  }
}
