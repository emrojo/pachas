import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'unreachable' | 'not_configured' = 'not_configured';
  let dbLatencyMs: number | null = null;

  try {
    const pool = getDbPool();
    if (pool) {
      const dbCheckStart = Date.now();
      await pool.query('SELECT 1');
      dbLatencyMs = Date.now() - dbCheckStart;
      dbStatus = 'connected';
    }
  } catch {
    dbStatus = 'unreachable';
  }

  const isHealthy = dbStatus !== 'unreachable';

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'production',
      services: {
        web: 'healthy',
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
      },
      latencyMs: Date.now() - startTime,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Content-Type': 'application/json',
      },
    }
  );
}
