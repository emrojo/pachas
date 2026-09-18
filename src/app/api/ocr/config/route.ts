import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { getOcrConfig, setOcrConfig, OcrProvider } from '@/lib/ocr/ocrConfig';
import { checkOllamaHealth } from '@/lib/ocr/ollamaScanner';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const config = await getOcrConfig(true);
    const ollamaHealth = await checkOllamaHealth(config.ollamaBaseUrl);

    return NextResponse.json({
      success: true,
      data: {
        provider: config.provider,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
        hasGeminiKey: config.hasGeminiKey,
        ollama: {
          status: ollamaHealth.online ? 'online' : 'offline',
          latencyMs: ollamaHealth.latencyMs,
          serviceType: ollamaHealth.serviceType,
          availableModels: ollamaHealth.models,
          error: ollamaHealth.error,
        },
        gemini: {
          status: config.hasGeminiKey ? 'configured' : 'missing',
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error al obtener la configuración de OCR' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await request.json();
    const { provider, ollamaBaseUrl, ollamaModel } = body;

    const updates: Partial<{ provider: OcrProvider; ollamaBaseUrl: string; ollamaModel: string }> = {};

    if (provider) {
      const p = String(provider).toLowerCase().trim();
      if (p !== 'ollama' && p !== 'gemini') {
        return NextResponse.json(
          { success: false, error: 'El proveedor debe ser "ollama" o "gemini"' },
          { status: 400 }
        );
      }
      updates.provider = p as OcrProvider;
    }

    if (typeof ollamaBaseUrl === 'string' && ollamaBaseUrl.trim()) {
      updates.ollamaBaseUrl = ollamaBaseUrl.trim();
    }

    if (typeof ollamaModel === 'string' && ollamaModel.trim()) {
      updates.ollamaModel = ollamaModel.trim();
    }

    const updated = await setOcrConfig(updates, authResult.user?.userId);
    const ollamaHealth = await checkOllamaHealth(updated.ollamaBaseUrl);

    return NextResponse.json({
      success: true,
      message: 'Configuración de OCR actualizada correctamente',
      data: {
        provider: updated.provider,
        ollamaBaseUrl: updated.ollamaBaseUrl,
        ollamaModel: updated.ollamaModel,
        hasGeminiKey: updated.hasGeminiKey,
        ollama: {
          status: ollamaHealth.online ? 'online' : 'offline',
          latencyMs: ollamaHealth.latencyMs,
          serviceType: ollamaHealth.serviceType,
          availableModels: ollamaHealth.models,
          error: ollamaHealth.error,
        },
        gemini: {
          status: updated.hasGeminiKey ? 'configured' : 'missing',
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error al guardar la configuración de OCR' },
      { status: 500 }
    );
  }
}
