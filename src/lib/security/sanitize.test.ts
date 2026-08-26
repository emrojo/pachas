import { describe, it, expect } from 'vitest';
import { sanitizeText } from './sanitize';

describe('sanitizeText', () => {
  it('escapes dangerous HTML characters', () => {
    const malicious = '<script>alert("XSS")</script>';
    const sanitized = sanitizeText(malicious);
    expect(sanitized).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
  });

  it('escapes quotes and ampersands', () => {
    const text = 'John & "Jane" \'Doe\' / test';
    const sanitized = sanitizeText(text);
    expect(sanitized).toBe('John &amp; &quot;Jane&quot; &#x27;Doe&#x27; &#x2F; test');
  });

  it('enforces maximum character length', () => {
    const longString = 'a'.repeat(600);
    const sanitized = sanitizeText(longString, 100);
    expect(sanitized.length).toBe(100);
  });

  it('handles null and undefined safely', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText('')).toBe('');
  });
});
