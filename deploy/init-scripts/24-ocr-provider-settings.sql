-- ==============================================================================
-- PACHAS MIGRATION 24: APPLICATION SETTINGS & OCR PROVIDER CONFIGURATION
-- ==============================================================================
-- Allows runtime configuration of OCR provider (Ollama / Gemini) and external services
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Clean up uncustomized initial seed so container environment variables (OLLAMA_BASE_URL, OLLAMA_MODEL) take precedence
DELETE FROM public.app_settings
WHERE updated_by IS NULL
  AND key IN ('ollama_base_url', 'ollama_model')
  AND value IN ('http://127.0.0.1:11434', 'qwen2.5vl:7b');
