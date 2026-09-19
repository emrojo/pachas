import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callOllamaVision, checkOllamaHealth } from './ollamaScanner';

describe('Ollama / ScanBills OCR Scanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('checks Ollama health via /api/tags when native service is running', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'qwen2.5vl:7b' },
          { name: 'qwen2.5vl:3b' },
        ],
      }),
    });

    const health = await checkOllamaHealth('http://127.0.0.1:11434');
    expect(health.online).toBe(true);
    expect(health.serviceType).toBe('ollama');
    expect(health.models).toContain('qwen2.5vl:7b');
    expect(health.models).toContain('qwen2.5vl:3b');
  });

  it('checks ScanBills health via /api/v1/health when FastAPI service is running', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/health')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'healthy',
            ollama_connected: true,
            available_models: ['qwen2.5vl:7b'],
          }),
        });
      }
      return Promise.reject(new Error('Connection refused'));
    });

    const health = await checkOllamaHealth('http://127.0.0.1:8030');
    expect(health.online).toBe(true);
    expect(health.serviceType).toBe('scanbills');
    expect(health.models).toContain('qwen2.5vl:7b');
  });

  it('handles offline Ollama service gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const health = await checkOllamaHealth('http://127.0.0.1:11434');
    expect(health.online).toBe(false);
    expect(health.serviceType).toBe('none');
    expect(health.models).toHaveLength(0);
  });

  it('successfully invokes native Ollama /api/chat and receives structured JSON content', async () => {
    const mockJson = JSON.stringify({
      title: 'Restaurante Ollama',
      amount: 42.50,
      category: 'food',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'qwen2.5vl:7b',
        message: {
          role: 'assistant',
          content: mockJson,
        },
      }),
    });

    const res = await callOllamaVision({
      imageBase64: 'data:image/jpeg;base64,dGVzdA==',
      prompt: 'Analiza este ticket',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5vl:7b',
    });

    expect(res.success).toBe(true);
    expect(res.rawContent).toBe(mockJson);
    expect(res.modelUsed).toBe('qwen2.5vl:7b');
  });

  it('successfully invokes ScanBills /api/v1/extract/base64 endpoint when port 8030 is configured', async () => {
    const mockReceipt = {
      title: 'Supermercado ScanBills',
      amount: 15.20,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockReceipt,
        model_used: 'qwen2.5vl:7b',
      }),
    });

    const res = await callOllamaVision({
      imageBase64: 'dGVzdA==',
      prompt: 'Analiza este ticket',
      baseUrl: 'http://127.0.0.1:8030',
      model: 'qwen2.5vl:7b',
    });

    expect(res.success).toBe(true);
    expect(res.rawContent).toBe(JSON.stringify(mockReceipt));
    expect(res.modelUsed).toBe('qwen2.5vl:7b');
  });

  it('successfully invokes ScanBills /api/v1/extract/base64 endpoint when Docker internal url (scanbills-web-cpu:8000) is configured', async () => {
    const mockReceipt = {
      title: 'Restaurante Docker',
      amount: 28.90,
    };

    let calledUrl = '';
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: mockReceipt,
          model_used: 'qwen2.5vl:3b',
        }),
      });
    });

    const res = await callOllamaVision({
      imageBase64: 'dGVzdA==',
      prompt: 'Analiza este ticket',
      baseUrl: 'http://scanbills-web-cpu:8000',
      model: 'qwen2.5vl:3b',
    });

    expect(res.success).toBe(true);
    expect(calledUrl).toBe('http://scanbills-web-cpu:8000/api/v1/extract/base64');
    expect(res.rawContent).toBe(JSON.stringify(mockReceipt));
    expect(res.modelUsed).toBe('qwen2.5vl:3b');
  });

  it('handles empty image base64 input gracefully without network call', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await callOllamaVision({
      imageBase64: '',
      prompt: 'Analiza este ticket',
    });

    expect(res.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes default num_ctx: 16384 and num_predict: 4096 in options to native Ollama /api/chat', async () => {
    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'qwen2.5vl:3b',
          message: { role: 'assistant', content: '{"ok":true}' },
        }),
      });
    });

    const res = await callOllamaVision({
      imageBase64: 'data:image/jpeg;base64,dGVzdA==',
      prompt: 'Analiza este ticket',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5vl:3b',
    });

    expect(res.success).toBe(true);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.options).toBeDefined();
    expect(capturedBody.options.num_ctx).toBe(16384);
    expect(capturedBody.options.num_predict).toBe(4096);
  });

  it('respects OLLAMA_NUM_CTX environment variable or custom numCtx parameter', async () => {
    const originalEnv = process.env.OLLAMA_NUM_CTX;
    process.env.OLLAMA_NUM_CTX = '32768';

    let capturedBody: any = null;
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'qwen2.5vl:3b',
          message: { role: 'assistant', content: '{"ok":true}' },
        }),
      });
    });

    try {
      const res = await callOllamaVision({
        imageBase64: 'dGVzdA==',
        prompt: 'Analiza este ticket',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen2.5vl:3b',
      });

      expect(res.success).toBe(true);
      expect(capturedBody.options.num_ctx).toBe(32768);
    } finally {
      process.env.OLLAMA_NUM_CTX = originalEnv;
    }
  });

  it('auto-heals and retries with expanded num_ctx when Ollama returns exceed_context_size_error', async () => {
    const errorPayload = JSON.stringify({
      error: JSON.stringify({
        code: 400,
        message: 'request (5354 tokens) exceeds the available context size (4096 tokens), try increasing it',
        type: 'exceed_context_size_error',
        n_prompt_tokens: 5354,
        n_ctx: 4096,
      }),
    });

    const requests: any[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      const body = JSON.parse(init.body);
      requests.push(body);

      // First call fails with 400 exceed_context_size_error
      if (requests.length === 1) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => errorPayload,
        });
      }

      // Second call (auto-healing retry) succeeds
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'qwen2.5vl:3b',
          message: {
            role: 'assistant',
            content: '{"title":"Ticket Recuperado","amount":50.00}',
          },
        }),
      });
    });

    const res = await callOllamaVision({
      imageBase64: 'dGVzdA==',
      prompt: 'Analiza este ticket con imagen grande',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5vl:3b',
      numCtx: 4096, // Simulate low context window
    });

    expect(res.success).toBe(true);
    expect(requests.length).toBe(2);
    expect(requests[0].options.num_ctx).toBe(4096);
    // Auto-healed: expanded to at least prompt tokens (5354) + 4096 = 9450 -> 16384 minimum
    expect(requests[1].options.num_ctx).toBeGreaterThanOrEqual(9450);
    expect(res.rawContent).toContain('Ticket Recuperado');
  });

  it('preserves the primary model HTTP 400 error instead of masking with 404 from candidate models', async () => {
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      const body = JSON.parse(init.body);
      if (body.model === 'qwen2.5vl:3b') {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => '{"error":"Invalid request payload"}',
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => `model '${body.model}' not found`,
      });
    });

    const res = await callOllamaVision({
      imageBase64: 'dGVzdA==',
      prompt: 'Analiza este ticket',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5vl:3b',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('HTTP 400 (qwen2.5vl:3b)');
  });

  it('only invokes the primary model when fallbackModels is empty or OLLAMA_FALLBACK_MODELS=none', async () => {
    const originalEnv = process.env.OLLAMA_FALLBACK_MODELS;
    process.env.OLLAMA_FALLBACK_MODELS = 'none';

    const modelsCalled: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      const body = JSON.parse(init.body);
      modelsCalled.push(body.model);
      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => 'model not found',
      });
    });

    try {
      const res = await callOllamaVision({
        imageBase64: 'dGVzdA==',
        prompt: 'Analiza este ticket',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen2.5vl:3b',
      });

      expect(res.success).toBe(false);
      expect(modelsCalled).toEqual(['qwen2.5vl:3b']);
    } finally {
      process.env.OLLAMA_FALLBACK_MODELS = originalEnv;
    }
  });

  it('invokes configured custom fallbackModels in order when primary model fails with 404', async () => {
    const modelsCalled: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
      const body = JSON.parse(init.body);
      modelsCalled.push(body.model);
      if (body.model === 'primary:3b') {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => 'primary not found',
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: body.model,
          message: { role: 'assistant', content: '{"ok":true}' },
        }),
      });
    });

    const res = await callOllamaVision({
      imageBase64: 'dGVzdA==',
      prompt: 'Analiza este ticket',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'primary:3b',
      fallbackModels: ['fallback-a:3b', 'fallback-b:7b'],
    });

    expect(res.success).toBe(true);
    expect(modelsCalled).toEqual(['primary:3b', 'fallback-a:3b']);
    expect(res.modelUsed).toBe('fallback-a:3b');
  });
});
