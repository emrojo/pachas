import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { realtimeHub } from '@/lib/realtime/sse';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request, { allowBanned: true });
    // Banned users should not receive live events if banned
    if (authResult.isBanned) {
      return NextResponse.json({ error: 'Usuario suspendido' }, { status: 403 });
    }

    const currentUserId = authResult.user?.userId || 'anonymous';
    const { searchParams } = new URL(request.url);
    const targetGroupId = searchParams.get('groupId');

    const clientId = `client-${randomUUID()}`;

    let cleanupFn: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // 1. Send initial connection established message
        controller.enqueue(
          encoder.encode(`: connected\nid: ${clientId}\nevent: open\ndata: {"status":"connected","time":"${new Date().toISOString()}"}\n\n`)
        );

        // 2. Register with RealtimeHub
        cleanupFn = realtimeHub.registerClient({
          id: clientId,
          userId: currentUserId,
          groupId: targetGroupId || undefined,
          send: (formattedData: string) => {
            try {
              controller.enqueue(encoder.encode(formattedData));
            } catch {
              if (cleanupFn) {
                cleanupFn();
                cleanupFn = null;
              }
            }
          },
          close: () => {
            try {
              controller.close();
            } catch {}
          },
        });
      },
      cancel() {
        if (cleanupFn) {
          cleanupFn();
          cleanupFn = null;
        }
      },
    });

    request.signal.addEventListener('abort', () => {
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    console.error('Error establishing SSE connection:', err);
    return NextResponse.json(
      { error: 'Error al establecer conexión en tiempo real' },
      { status: 500 }
    );
  }
}
