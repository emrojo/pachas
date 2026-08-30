import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/share-receive
 * Receives a multipart/form-data payload from the PWA Web Share Target.
 * Validates the file, converts it to base64, and returns metadata the
 * client page uses to drive the OCR + expense-creation flow.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string | null) ?? '';
    const text = (formData.get('text') as string | null) ?? '';

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    // Validate MIME type
    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado. Solo se aceptan PDF, JPG, PNG o WebP.' },
        { status: 415 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'El archivo supera el límite de 10 MB.' },
        { status: 413 }
      );
    }

    // Convert to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      fileName: file.name || 'archivo',
      mimeType,
      isPdf: mimeType === 'application/pdf',
      dataUrl,
      sharedTitle: title,
      sharedText: text,
    });
  } catch (err: any) {
    console.error('[share-receive] Error processing shared file:', err);
    return NextResponse.json(
      { error: 'Error al procesar el archivo compartido.' },
      { status: 500 }
    );
  }
}
