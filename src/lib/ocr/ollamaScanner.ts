export interface OllamaHealthResult {
  online: boolean;
  models: string[];
  latencyMs: number;
  serviceType: 'ollama' | 'scanbills' | 'none';
  error?: string;
}

export interface OllamaVisionRequest {
  imageBase64: string;
  mimeType?: string;
  prompt: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  numCtx?: number;
}

export interface OllamaVisionResponse {
  success: boolean;
  rawContent?: string;
  modelUsed?: string;
  error?: string;
}

function isScanBillsEndpoint(cleanUrl: string): boolean {
  if (cleanUrl.includes(':11434')) return false;
  return (
    cleanUrl.includes('scanbills-web') ||
    cleanUrl.includes(':8030') ||
    cleanUrl.includes(':8000') ||
    cleanUrl.includes('/api/v1')
  );
}

/**
 * Checks the status of the local/remote Ollama or ScanBills service
 */
export async function checkOllamaHealth(baseUrl = 'http://127.0.0.1:11434'): Promise<OllamaHealthResult> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const start = Date.now();

  // 1. If ScanBills FastAPI endpoint (:8000, :8030, scanbills-web or /api/v1), try /api/v1/health first
  if (isScanBillsEndpoint(cleanUrl)) {
    try {
      const healthUrl = cleanUrl.endsWith('/api/v1') ? `${cleanUrl}/health` : `${cleanUrl}/api/v1/health`;
      const scanBillsRes = await fetch(healthUrl, {
        signal: AbortSignal.timeout(3000),
      });
      if (scanBillsRes.ok) {
        const data = await scanBillsRes.json();
        return {
          online: Boolean(data.ollama_connected || data.status === 'healthy'),
          models: Array.isArray(data.available_models) ? data.available_models : [],
          latencyMs: Date.now() - start,
          serviceType: 'scanbills',
        };
      }
    } catch {}
  }

  // 2. Try native Ollama /api/tags
  try {
    const tagsRes = await fetch(`${cleanUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (tagsRes.ok) {
      const data = await tagsRes.json();
      const models = (data.models || []).map((m: any) => m.name || m.model).filter(Boolean);
      return {
        online: true,
        models,
        latencyMs: Date.now() - start,
        serviceType: 'ollama',
      };
    }
  } catch {}

  // 3. Fallback: try ScanBills /api/v1/health if /api/tags didn't succeed
  try {
    const healthUrl = cleanUrl.endsWith('/api/v1') ? `${cleanUrl}/health` : `${cleanUrl}/api/v1/health`;
    const scanBillsRes = await fetch(healthUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (scanBillsRes.ok) {
      const data = await scanBillsRes.json();
      return {
        online: Boolean(data.ollama_connected || data.status === 'healthy'),
        models: Array.isArray(data.available_models) ? data.available_models : [],
        latencyMs: Date.now() - start,
        serviceType: 'scanbills',
      };
    }
  } catch (err: any) {
    return {
      online: false,
      models: [],
      latencyMs: Date.now() - start,
      serviceType: 'none',
      error: err.message || 'Error de conexión con Ollama',
    };
  }

  return {
    online: false,
    models: [],
    latencyMs: Date.now() - start,
    serviceType: 'none',
    error: 'Servicio no responde',
  };
}

/**
 * Sends image and prompt to Ollama / ScanBills Vision-Language Model
 */
export async function callOllamaVision({
  imageBase64,
  prompt,
  baseUrl = 'http://127.0.0.1:11434',
  model = 'qwen2.5vl:7b',
  timeoutMs,
  numCtx,
}: OllamaVisionRequest): Promise<OllamaVisionResponse> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();

  if (!cleanBase64) {
    return { success: false, error: 'Imagen en base64 vacía o no válida' };
  }

  const effectiveTimeoutMs = timeoutMs ?? (Number(process.env.OLLAMA_TIMEOUT_MS) || 120000);
  const initialNumCtx = numCtx ?? (Number(process.env.OLLAMA_NUM_CTX) || 16384);

  // 1. If baseUrl indicates ScanBills FastAPI endpoint (:8000, :8030, scanbills-web or /api/v1), call /api/v1/extract/base64
  if (isScanBillsEndpoint(cleanUrl)) {
    try {
      console.log(`[Ollama OCR] 🦙 Consultando servicio ScanBills OCR en ${cleanUrl}/api/v1/extract/base64...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      const endpoint = cleanUrl.endsWith('/api/v1') ? `${cleanUrl}/extract/base64` : `${cleanUrl}/api/v1/extract/base64`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          image_base64: cleanBase64,
          prompt,
          model,
          force_json: true,
          redact_pii: false,
          num_ctx: initialNumCtx,
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const raw = typeof json.data === 'object' ? JSON.stringify(json.data) : json.raw_response;
          return {
            success: true,
            rawContent: raw,
            modelUsed: json.model_used || model,
          };
        }
      }
    } catch (sbErr: any) {
      console.warn('[Ollama OCR] ScanBills endpoint fallo, intentando fallback a Ollama nativo:', sbErr.message);
    }
  }

  // 2. Native Ollama /api/chat invocation with candidate model list
  const candidateModels = [
    model,
    'qwen2.5vl:7b',
    'qwen2.5vl:3b',
    'qwen2.5-vl:7b',
    'qwen2.5-vl:3b',
    'llama3.2-vision',
    'minicpm-v',
    'llava',
  ];

  const triedModels = new Set<string>();
  let lastError = '';
  let primaryModelError = '';

  for (const m of candidateModels) {
    if (!m || triedModels.has(m)) continue;
    triedModels.add(m);

    let currentCtx = initialNumCtx;
    let hasRetriedWithExpandedCtx = false;

    // Retry loop for context expansion if exceed_context_size_error occurs
    while (true) {
      try {
        console.log(`[Ollama OCR] 🦙 Invocando Ollama /api/chat con modelo "${m}" (num_ctx: ${currentCtx}) en ${cleanUrl}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

        const res = await fetch(`${cleanUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: m,
            messages: [
              {
                role: 'user',
                content: prompt,
                images: [cleanBase64],
              },
            ],
            stream: false,
            format: 'json',
            options: {
              temperature: 0.1,
              num_predict: 4096,
              num_ctx: currentCtx,
            },
          }),
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const content = data?.message?.content;
          if (content && typeof content === 'string' && content.trim()) {
            console.log(`[Ollama OCR] ✅ Respuesta recibida de Ollama (${m}): ${content.length} caracteres`);
            return {
              success: true,
              rawContent: content,
              modelUsed: data.model || m,
            };
          }
        } else {
          const errText = await res.text().catch(() => '');
          lastError = `HTTP ${res.status} (${m}): ${errText}`;
          if (!primaryModelError && m === model) {
            primaryModelError = lastError;
          }
          console.warn(`[Ollama OCR] Modelo ${m} no disponible o error:`, lastError);

          // Check if error is context window overflow: "exceed_context_size_error" or "exceeds the available context size"
          const isContextOverflow =
            res.status === 400 &&
            (errText.includes('exceed_context_size_error') ||
              errText.includes('exceeds the available context size'));

          if (isContextOverflow && !hasRetriedWithExpandedCtx) {
            hasRetriedWithExpandedCtx = true;

            // Try to extract prompt token count, e.g. "n_prompt_tokens": 5354 or "request (5354 tokens) exceeds"
            let promptTokens = 0;
            try {
              const parsedErr = JSON.parse(errText);
              const innerErr = typeof parsedErr.error === 'string' ? JSON.parse(parsedErr.error) : parsedErr.error;
              promptTokens = innerErr?.n_prompt_tokens || 0;
            } catch {
              const match = errText.match(/(?:n_prompt_tokens"|request\s*\()\s*[:=]?\s*(\d+)/i);
              if (match && match[1]) {
                promptTokens = parseInt(match[1], 10);
              }
            }

            const expandedCtx = Math.min(
              65536,
              Math.max(promptTokens > 0 ? promptTokens + 4096 : currentCtx * 2, 16384)
            );

            if (expandedCtx > currentCtx) {
              console.warn(
                `[Ollama OCR] 🔄 Límite de contexto superado (${promptTokens || 'muchos'} tokens vs ${currentCtx}). Auto-ampliando num_ctx a ${expandedCtx} y reintentando con ${m}...`
              );
              currentCtx = expandedCtx;
              continue; // retry with expanded context
            }
          }

          // If status is 400 (Bad Request / Syntax / Context), other uninstalled models won't help
          // Only continue to other candidate models if it was 404 (Not Found)
          if (res.status === 400 && m === model) {
            break;
          }
        }
      } catch (err: any) {
        lastError = err.message || 'Error de conexión con Ollama';
        if (!primaryModelError && m === model) {
          primaryModelError = lastError;
        }
        if (err.name === 'AbortError') {
          lastError = `Timeout de ${effectiveTimeoutMs}ms superado conectando a Ollama`;
          primaryModelError = lastError;
          break; // Do not retry other models on hard timeout
        }
      }
      break; // Exit while loop if no retry triggered
    }

    // If 400 occurred on primary model, do not try random models that are not installed
    if (primaryModelError && primaryModelError.startsWith('HTTP 400')) {
      break;
    }
  }

  return {
    success: false,
    error: primaryModelError || lastError || 'No se pudo obtener respuesta de Ollama',
  };
}
