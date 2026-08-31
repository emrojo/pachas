import { describe, it, expect } from 'vitest';

describe('Group Cover Photos Service', () => {
  it('normalizes queries and derives appropriate photo themes', () => {
    const normalizeQuery = (text: string): string => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();
    };

    expect(normalizeQuery('¡Viaje a Roma 2026!')).toBe('viaje a roma 2026');
    expect(normalizeQuery('Vacaciones en la playa (Mallorca)')).toBe('vacaciones en la playa  mallorca');
    expect(normalizeQuery('Cena de Navidad 🎄')).toBe('cena de navidad');
  });

  it('matches keyword tokens against categories', () => {
    const catalog = [
      { keywords: ['playa', 'beach', 'cala', 'mar', 'mallorca', 'ibiza'], theme: 'beach' },
      { keywords: ['montana', 'mountain', 'pirineos', 'sierra', 'senderismo'], theme: 'mountain' },
      { keywords: ['cena', 'comida', 'tapas', 'restaurante', 'bar'], theme: 'dinner' },
    ];

    const matchTheme = (query: string): string => {
      const q = query.toLowerCase();
      for (const item of catalog) {
        if (item.keywords.some((k) => q.includes(k))) {
          return item.theme;
        }
      }
      return 'general';
    };

    expect(matchTheme('Escapada a Mallorca')).toBe('beach');
    expect(matchTheme('Ruta por los Pirineos')).toBe('mountain');
    expect(matchTheme('Cena con amigos')).toBe('dinner');
    expect(matchTheme('Reunión')).toBe('general');
  });
});
