import { describe, it, expect } from 'vitest';
import { getGroupInvitationEmailHtml, sendGroupInvitationEmail } from '@/lib/email/mailer';

describe('Group Invitation Email System', () => {
  it('generates valid HTML & text email templates with inviter, group name, emoji, and link', () => {
    const { html, text, subject } = getGroupInvitationEmailHtml({
      to: 'amigo@example.com',
      groupName: 'Viaje a Roma 2026',
      groupEmoji: '✈️',
      inviterName: 'Eduardo Rojo',
      inviteUrl: 'https://pachas.app/join/roma2026',
      customMessage: '¡Hola! Vamos metiendo los gastos del apartamento y vuelos aquí.',
    });

    expect(subject).toContain('Eduardo Rojo');
    expect(subject).toContain('Viaje a Roma 2026');

    // Check HTML contents
    expect(html).toContain('Eduardo Rojo');
    expect(html).toContain('Viaje a Roma 2026');
    expect(html).toContain('✈️');
    expect(html).toContain('https://pachas.app/join/roma2026');
    expect(html).toContain('Unirme al Grupo');
    expect(html).toContain('¡Hola! Vamos metiendo los gastos del apartamento y vuelos aquí.');
    expect(html).toContain('Pachas');

    // Check plain text contents
    expect(text).toContain('Eduardo Rojo');
    expect(text).toContain('Viaje a Roma 2026');
    expect(text).toContain('https://pachas.app/join/roma2026');
    expect(text).toContain('¡Hola! Vamos metiendo los gastos del apartamento y vuelos aquí.');
  });

  it('handles invitation without optional custom message cleanly', () => {
    const { html, text, subject } = getGroupInvitationEmailHtml({
      to: 'companero@example.com',
      groupName: 'Cena de Navidad',
      inviteUrl: 'https://pachas.app/join/cena123',
    });

    expect(subject).toContain('Cena de Navidad');
    expect(html).toContain('Cena de Navidad');
    expect(html).toContain('https://pachas.app/join/cena123');
    expect(html).not.toContain('<div class="custom-message-box">');
    expect(text).not.toContain('Mensaje de');
  });

  it('runs simulation fallback safely when external mail provider is not set', async () => {
    const result = await sendGroupInvitationEmail({
      to: 'simulado@test.com',
      groupName: 'Escapada Rural',
      groupEmoji: '🏡',
      inviterName: 'María',
      inviteUrl: 'http://localhost:3000/join/escapada789',
      customMessage: 'Recordad guardar los tickets de la compra.',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('simulation');
  });
});
