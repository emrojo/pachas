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

-- Initialize default OCR provider to 'ollama' (powered by scan-bills-ocr / Qwen2.5-VL)
INSERT INTO public.app_settings (key, value)
VALUES ('ocr_provider', 'ollama')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('ollama_base_url', 'http://127.0.0.1:11434')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('ollama_model', 'qwen2.5vl:7b')
ON CONFLICT (key) DO NOTHING;
