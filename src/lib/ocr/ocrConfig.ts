import fs from 'fs';
import path from 'path';
import { getDbPool } from '@/lib/db/postgres';

export type OcrProvider = 'ollama' | 'gemini';

export interface OcrConfig {
  provider: OcrProvider;
  ollamaBaseUrl: string;
  ollamaModel: string;
  hasGeminiKey: boolean;
  geminiApiKey?: string;
}

let cachedConfig: OcrConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

export function getGeminiApiKey(): string | undefined {
  const sanitizeKey = (raw?: string) => {
    if (!raw) return undefined;
    const clean = raw.trim().replace(/^["']|["']$/g, '').trim();
    if (!clean || clean.startsWith('AIzaSy...') || clean === 'tu_api_key_aqui') {
      return undefined;
    }
    return clean;
  };

  const envKey = sanitizeKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  if (envKey) return envKey;

  const candidatePaths = [
    path.resolve(process.cwd(), 'deploy/.env.production'),
    path.resolve(process.cwd(), '.env.production'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), 'deploy/.env'),
    path.resolve(process.cwd(), '.env'),
    '/app/deploy/.env.production',
    '/app/.env.production',
    '/app/.env.local',
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(/* turbopackIgnore: true */ p)) {
        const content = fs.readFileSync(/* turbopackIgnore: true */ p, 'utf-8');
        const match = content.match(/^\s*(?:GEMINI_API_KEY|GOOGLE_AI_API_KEY)\s*=\s*(?:["']?)([^#\r\n"']+)(?:["']?)/m);
        if (match && match[1]) {
          const key = sanitizeKey(match[1]);
          if (key) {
            process.env.GEMINI_API_KEY = key;
            return key;
          }
        }
      }
    } catch {}
  }

  return undefined;
}

export function getDefaultEnvOcrConfig(): OcrConfig {
  const rawProvider = (process.env.OCR_PROVIDER || 'ollama').toLowerCase().trim();
  const provider: OcrProvider = rawProvider === 'gemini' ? 'gemini' : 'ollama';
  const ollamaBaseUrl = (
    process.env.OLLAMA_BASE_URL ||
    process.env.SCANBILLS_OCR_URL ||
    'http://127.0.0.1:11434'
  ).replace(/\/+$/, '');
  const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5vl:3b';
  const apiKey = getGeminiApiKey();

  return {
    provider,
    ollamaBaseUrl,
    ollamaModel,
    hasGeminiKey: Boolean(apiKey),
    geminiApiKey: apiKey,
  };
}

export async function getOcrConfig(forceFresh = false): Promise<OcrConfig> {
  const now = Date.now();
  if (!forceFresh && cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const baseConfig = getDefaultEnvOcrConfig();

  try {
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query(
        `SELECT key, value, updated_by FROM public.app_settings WHERE key IN ('ocr_provider', 'ollama_base_url', 'ollama_model')`
      );

      const dbMap = new Map<string, { value: string; updatedBy: string | null }>();
      for (const row of res.rows) {
        dbMap.set(row.key, { value: row.value, updatedBy: row.updated_by });
      }

      if (dbMap.has('ocr_provider')) {
        const item = dbMap.get('ocr_provider')!;
        const p = item.value?.toLowerCase().trim();
        if (p === 'gemini' || p === 'ollama') {
          baseConfig.provider = p;
        }
      }

      if (dbMap.has('ollama_base_url')) {
        const item = dbMap.get('ollama_base_url')!;
        const url = item.value?.trim();
        // Respect explicit environment variable if DB value was just uncustomized seed (updatedBy === null)
        const hasExplicitEnvUrl = Boolean(process.env.OLLAMA_BASE_URL || process.env.SCANBILLS_OCR_URL);
        if (url && (item.updatedBy !== null || !hasExplicitEnvUrl)) {
          baseConfig.ollamaBaseUrl = url.replace(/\/+$/, '');
        }
      }

      if (dbMap.has('ollama_model')) {
        const item = dbMap.get('ollama_model')!;
        const m = item.value?.trim();
        const hasExplicitEnvModel = Boolean(process.env.OLLAMA_MODEL);
        if (m && (item.updatedBy !== null || !hasExplicitEnvModel)) {
          baseConfig.ollamaModel = m;
        }
      }
    }
  } catch (err) {
    // If DB read fails, silently fallback to env configuration
  }

  cachedConfig = baseConfig;
  lastFetchTime = now;
  return baseConfig;
}

export async function setOcrConfig(
  newConfig: Partial<Pick<OcrConfig, 'provider' | 'ollamaBaseUrl' | 'ollamaModel'>>,
  updatedBy?: string
): Promise<OcrConfig> {
  const pool = getDbPool();
  if (pool) {
    if (newConfig.provider) {
      await pool.query(
        `INSERT INTO public.app_settings (key, value, updated_at, updated_by)
         VALUES ('ocr_provider', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [newConfig.provider, updatedBy || null]
      );
    }

    if (newConfig.ollamaBaseUrl) {
      await pool.query(
        `INSERT INTO public.app_settings (key, value, updated_at, updated_by)
         VALUES ('ollama_base_url', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [newConfig.ollamaBaseUrl.replace(/\/+$/, ''), updatedBy || null]
      );
    }

    if (newConfig.ollamaModel) {
      await pool.query(
        `INSERT INTO public.app_settings (key, value, updated_at, updated_by)
         VALUES ('ollama_model', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [newConfig.ollamaModel.trim(), updatedBy || null]
      );
    }
  }

  // Refresh and cache
  return await getOcrConfig(true);
}
