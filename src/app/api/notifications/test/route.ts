import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { sendPushToUsers } from '@/lib/notifications/webPush';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    let userId: string | null = null;

    if (token) {
      const payload = await verifyJwt(token);
      if (payload?.sub) {
        userId = payload.sub;
      }
    }

    if (!userId) {
      const demoCookie = request.cookies.get('pachas_demo_user')?.value;
      if (demoCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(demoCookie));
          userId = parsed.id;
        } catch {}
      }
    }

    if (!userId) {
      try {
        const body = await request.json();
        userId = body.userId || null;
      } catch {}
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para enviar una notificación de prueba.' },
        { status: 401 }
      );
    }

    const testPayload = {
      title: '🔔 Notificación de prueba - Pachas',
      body: '¡Funciona perfectamente! Tu dispositivo está listo para recibir avisos de gastos y comentarios.',
      url: '/dashboard',
      tag: 'pachas-test-notification',
    };

    const result = await sendPushToUsers([userId], testPayload);

    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      failureCount: result.failureCount,
      message:
        result.sentCount > 0
          ? 'Notificación enviada a tu dispositivo con éxito.'
          : 'Dispositivo registrado localmente.',
    });
  } catch (err: any) {
    console.error('Error in test notification route:', err);
    return NextResponse.json(
      { error: err.message || 'Error al enviar notificación de prueba' },
      { status: 500 }
    );
  }
}
