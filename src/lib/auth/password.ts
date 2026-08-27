import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

/**
 * Hashes a plaintext password with a random cryptographic salt.
 * Returns format: "pbkdf2:salt:hash"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored hashed password.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Support pbkdf2 formatted hash
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHash] = parts;
    const computedHash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    try {
      return timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
    } catch {
      return false;
    }
  }

  // Fallback for plain bcrypt / simple compare if legacy
  return false;
}
