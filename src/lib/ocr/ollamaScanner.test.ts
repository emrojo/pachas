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
});
