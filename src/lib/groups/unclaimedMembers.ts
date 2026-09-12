import { randomUUID } from 'crypto';

export const FRIENDLY_NAME_SUGGESTIONS = [
  'Amigo',
  'Compañero',
  'Viajero',
  'Aventurero',
  'Explorador',
  'Pachero',
  'Colega',
  'Copiloto',
];

/**
 * Generates default provisional names for a given count of members.
 * e.g., count = 3 -> ['Amigo 1', 'Amigo 2', 'Amigo 3']
 */
export function generateProvisionalNames(count: number, startNumber = 1): string[] {
  const safeCount = Math.max(0, Math.min(count, 50));
  const names: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    names.push(`Amigo ${startNumber + i}`);
  }
  return names;
}

/**
 * Generates a list of fun, friendly themed nicknames for provisional members.
 */
export function generateFunProvisionalNames(count: number): string[] {
  const safeCount = Math.max(0, Math.min(count, 50));
  const names: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const base = FRIENDLY_NAME_SUGGESTIONS[i % FRIENDLY_NAME_SUGGESTIONS.length];
    const num = Math.floor(i / FRIENDLY_NAME_SUGGESTIONS.length) + 1;
    names.push(num > 1 ? `${base} ${num}` : base);
  }
  return names;
}

/**
 * Generates a secure unique claim token for an unclaimed member invitation.
 */
export function generateClaimToken(): string {
  try {
    return randomUUID();
  } catch {
    return 'claim_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
  }
}

/**
 * Builds the unique invitation URL for claiming a provisional member.
 */
export function buildClaimUrl(baseUrl: string, inviteCode: string, claimToken: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/join/${encodeURIComponent(inviteCode)}?claim=${encodeURIComponent(claimToken)}`;
}
