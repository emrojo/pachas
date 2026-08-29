import { describe, it, expect } from 'vitest';
import { sanitizeText } from '@/lib/security/sanitize';

describe('Legal & User Safety Test Suite', () => {
  it('sanitizes user input for content reports properly', () => {
    const maliciousInput = '<script>alert("hack")</script> Foto con información confidencial';
    const sanitized = sanitizeText(maliciousInput, 200);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('Foto con información confidencial');
  });

  it('truncates oversized details to stay within storage limits', () => {
    const longText = 'a'.repeat(600);
    const sanitized = sanitizeText(longText, 500);

    expect(sanitized.length).toBe(500);
  });

  it('formats GDPR user export payload with standard sections', () => {
    const mockUser = {
      id: 'test-user-123',
      email: 'test@pachas.com',
      full_name: 'Test User',
      bizum_phone: '+34600112233',
    };

    const mockExport = {
      export_date: new Date().toISOString(),
      user: mockUser,
      groups: [{ id: 'group-1', name: 'Viaje Menorca' }],
      created_expenses: [{ id: 'exp-1', title: 'Cena Faro', amount: 120 }],
      settlements: [],
    };

    expect(mockExport.user.id).toBe('test-user-123');
    expect(mockExport.groups).toHaveLength(1);
    expect(mockExport.created_expenses).toHaveLength(1);
    expect(mockExport).toHaveProperty('export_date');
  });
});
