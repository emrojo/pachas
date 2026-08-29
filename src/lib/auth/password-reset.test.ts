import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { getPasswordResetEmailHtml, sendPasswordResetEmail } from '@/lib/email/mailer';

describe('Password Reset Logic', () => {
  it('generates a new valid password hash after reset', () => {
    const originalPass = 'OldPass123!';
    const originalHash = hashPassword(originalPass);

    const newPass = 'NewSecurePass2026!';
    const newHash = hashPassword(newPass);

    expect(verifyPassword(originalPass, originalHash)).toBe(true);
    expect(verifyPassword(newPass, originalHash)).toBe(false);

    expect(verifyPassword(newPass, newHash)).toBe(true);
    expect(verifyPassword(originalPass, newHash)).toBe(false);
  });

  it('generates valid HTML & text templates for password recovery emails', () => {
    const { html, text } = getPasswordResetEmailHtml({
      to: 'usuario@pachas.com',
      resetUrl: 'https://pachas.com/reset-password?token=abc123token',
      fullName: 'Carlos García',
    });

    expect(html).toContain('Carlos García');
    expect(html).toContain('https://pachas.com/reset-password?token=abc123token');
    expect(html).toContain('Restablecer mi Contraseña');

    expect(text).toContain('Carlos García');
    expect(text).toContain('https://pachas.com/reset-password?token=abc123token');
  });

  it('runs simulation fallback safely when no SMTP is configured', async () => {
    const result = await sendPasswordResetEmail({
      to: 'test@example.com',
      resetUrl: 'http://localhost:3000/reset-password?token=simulated123',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('simulation');
  });
});
