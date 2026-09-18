export interface GeminiVisionRequest {
  imageBase64: string;
  mimeType?: string;
  prompt: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface GeminiVisionResponse {
  success: boolean;
  rawContent?: string;
  modelUsed?: string;
  error?: string;
}

export async function callGeminiVision({
  imageBase64,
  mimeType = 'image/jpeg',
  prompt,
  apiKey,
  timeoutMs = 35000,
}: GeminiVisionRequest): Promise<GeminiVisionResponse> {
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleanBase64) {
    return { success: false, error: 'Datos de imagen insuficientes' };
  }

  const candidateModels = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
  ];

  let lastError = '';
  let successfulModel = 'gemini-1.5-flash';

  const tryGenerateWithModel = async (modelName: string): Promise<string | null> => {
    try {
      const cleanName = modelName.replace(/^models\//, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanName}:generateContent?key=${apiKey}`;

      console.log(`[Gemini OCR] 📸 Probando modelo: ${cleanName}...`);

      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          successfulModel = cleanName;
          return text;
        }
      } else {
        const errText = await geminiResponse.text().catch(() => '');
        lastError = `HTTP ${geminiResponse.status} (${cleanName}): ${errText}`;
        console.warn(`[Gemini OCR] ${cleanName} no disponible:`, lastError);
      }
    } catch (err: any) {
      lastError = err.message || 'Error de conexión';
    }
    return null;
  };

  // 1. Try candidate models
  for (const m of candidateModels) {
    const resText = await tryGenerateWithModel(m);
    if (resText) {
      return {
        success: true,
        rawContent: resText,
        modelUsed: successfulModel,
      };
    }
  }

  // 2. Dynamic discovery with ListModels
  try {
    console.log('[Gemini OCR] 🔍 Consultando ModelService.ListModels para descubrir modelos disponibles...');
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl, { signal: AbortSignal.timeout(10000) });
    if (listRes.ok) {
      const listData = await listRes.json();
      const available = (listData.models || [])
        .filter(
          (m: any) =>
            m.supportedGenerationMethods?.includes('generateContent') &&
            m.name.toLowerCase().includes('gemini') &&
            !m.name.toLowerCase().includes('gemma') &&
            !m.name.toLowerCase().includes('embedding') &&
            !m.name.toLowerCase().includes('aqa') &&
            !m.name.toLowerCase().includes('imagen')
        )
        .map((m: any) => m.name)
        .sort((a: string, b: string) => {
          const aFlash = a.includes('flash') ? 0 : 1;
          const bFlash = b.includes('flash') ? 0 : 1;
          return aFlash - bFlash;
        });

      console.log('[Gemini OCR] 📋 Modelos Gemini visión disponibles:', available);

      for (const discoveredModel of available) {
        const resText = await tryGenerateWithModel(discoveredModel);
        if (resText) {
          return {
            success: true,
            rawContent: resText,
            modelUsed: successfulModel,
          };
        }
      }
    } else {
      const listErr = await listRes.text().catch(() => '');
      lastError = `ListModels HTTP ${listRes.status}: ${listErr}`;
    }
  } catch (listExc: any) {
    lastError = `ListModels Exception: ${listExc.message}`;
  }

  return {
    success: false,
    error: lastError || 'No se pudo generar contenido con Gemini',
  };
}
