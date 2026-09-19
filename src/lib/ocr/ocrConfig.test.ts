import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDefaultEnvOcrConfig, getGeminiApiKey } from './ocrConfig';

describe('OCR Provider Configuration Manager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to ollama provider when OCR_PROVIDER is not explicitly set', () => {
    delete process.env.OCR_PROVIDER;
    delete process.env.OLLAMA_MODEL;
    const config = getDefaultEnvOcrConfig();
    expect(config.provider).toBe('ollama');
    expect(config.ollamaBaseUrl).toBe('http://127.0.0.1:11434');
    expect(config.ollamaModel).toBe('qwen2.5vl:3b');
  });

  it('respects OCR_PROVIDER=gemini when configured via environment', () => {
    process.env.OCR_PROVIDER = 'gemini';
    const config = getDefaultEnvOcrConfig();
    expect(config.provider).toBe('gemini');
  });

  it('customizes OLLAMA_BASE_URL and OLLAMA_MODEL from environment', () => {
    process.env.OLLAMA_BASE_URL = 'http://192.168.1.100:11434/';
    process.env.OLLAMA_MODEL = 'qwen2.5vl:3b';
    const config = getDefaultEnvOcrConfig();
    expect(config.ollamaBaseUrl).toBe('http://192.168.1.100:11434');
    expect(config.ollamaModel).toBe('qwen2.5vl:3b');
  });

  it('reads GEMINI_API_KEY correctly and ignores placeholder values', () => {
    process.env.GEMINI_API_KEY = 'AIzaSy...dummy';
    expect(getGeminiApiKey()).toBeUndefined();

    process.env.GEMINI_API_KEY = 'valid-gemini-key-123';
    expect(getGeminiApiKey()).toBe('valid-gemini-key-123');
  });

  it('parses fallback models list correctly', async () => {
    const { parseFallbackModelsList } = await import('./ocrConfig');
    expect(parseFallbackModelsList(undefined)).toEqual([]);
    expect(parseFallbackModelsList('')).toEqual([]);
    expect(parseFallbackModelsList('none')).toEqual([]);
    expect(parseFallbackModelsList('false')).toEqual([]);
    expect(parseFallbackModelsList('qwen2.5vl:7b, llama3.2-vision')).toEqual(['qwen2.5vl:7b', 'llama3.2-vision']);
  });

  it('correctly configures OLLAMA_FALLBACK_MODELS and OCR_ENABLE_FALLBACK from environment', () => {
    process.env.OLLAMA_FALLBACK_MODELS = 'none';
    process.env.OCR_ENABLE_FALLBACK = 'false';

    const config = getDefaultEnvOcrConfig();
    expect(config.ollamaFallbackModels).toEqual([]);
    expect(config.enableFallback).toBe(false);

    process.env.OLLAMA_FALLBACK_MODELS = 'qwen2.5vl:7b,llava';
    process.env.OCR_ENABLE_FALLBACK = 'true';

    const configWithFallback = getDefaultEnvOcrConfig();
    expect(configWithFallback.ollamaFallbackModels).toEqual(['qwen2.5vl:7b', 'llava']);
    expect(configWithFallback.enableFallback).toBe(true);
  });
});
