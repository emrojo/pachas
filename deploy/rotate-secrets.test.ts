import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  generateHex,
  generatePassword,
  generateVapidKeys,
  parseEnvContent,
  updateEnvKeysInContent,
  createEnvBackup,
  restoreEnvBackup,
  validateEnvConfiguration,
} from './rotate-secrets.mjs';

describe('Pachas Secret Rotation Engine (rotate-secrets.mjs)', () => {
  const testDir = path.resolve('deploy', '.test-rotate');
  const testEnvFile = path.join(testDir, '.env.test');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('1. Cryptographic Generators', () => {
    it('generates high-entropy hex strings of correct length', () => {
      const hex32 = generateHex(32);
      expect(hex32).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hex32)).toBe(true);

      const hex16 = generateHex(16);
      expect(hex16).toHaveLength(32);
    });

    it('generates random passwords with special characters and sufficient length', () => {
      const pass = generatePassword(28);
      expect(pass).toHaveLength(28);
      expect(pass).not.toBe(generatePassword(28));
    });

    it('generates valid W3C VAPID EC keypair', () => {
      const vapid = generateVapidKeys();
      expect(vapid.publicKey).toBeDefined();
      expect(vapid.privateKey).toBeDefined();
      expect(vapid.publicKey.length).toBeGreaterThan(40);
      expect(vapid.privateKey.length).toBeGreaterThan(20);
    });
  });

  describe('2. Environment File Parsing & Updating', () => {
    it('parses existing env lines accurately', () => {
      const sample = `
# Comment here
APP_URL=http://localhost:3000
JWT_SECRET="super-secret-32-chars-long-string"
EMPTY_VAL=
      `;
      const parsed = parseEnvContent(sample) as Record<string, string>;
      expect(parsed.APP_URL).toBe('http://localhost:3000');
      expect(parsed.JWT_SECRET).toBe('super-secret-32-chars-long-string');
      expect(parsed.EMPTY_VAL).toBe('');
    });

    it('updates targeted keys without modifying unrelated lines or comments', () => {
      const sample = `# Header Comment
APP_URL=http://localhost:3000
# JWT Secret line
JWT_SECRET=old-secret-value
POSTGRES_PASSWORD=old-password
`;
      const updated = updateEnvKeysInContent(sample, {
        JWT_SECRET: 'new-rotated-secret-32-chars-min',
        POSTGRES_PASSWORD: 'new-postgres-password-123!',
      });

      expect(updated).toContain('# Header Comment');
      expect(updated).toContain('# JWT Secret line');
      expect(updated).toContain('APP_URL=http://localhost:3000');
      expect(updated).toContain('JWT_SECRET=new-rotated-secret-32-chars-min');
      expect(updated).toContain('POSTGRES_PASSWORD=new-postgres-password-123!');
      expect(updated).not.toContain('old-secret-value');
    });

    it('appends new keys if they did not exist in the original content', () => {
      const sample = `APP_URL=http://localhost:3000\n`;
      const updated = updateEnvKeysInContent(sample, {
        NEW_KEY: 'new_value',
      });
      expect(updated).toContain('APP_URL=http://localhost:3000');
      expect(updated).toContain('NEW_KEY=new_value');
    });
  });

  describe('3. Backup & Rollback Pipeline', () => {
    it('creates timestamped backup and restores accurately', () => {
      const initialContent = 'KEY_INITIAL=12345\n';
      fs.writeFileSync(testEnvFile, initialContent, 'utf8');

      const backupPath = createEnvBackup(testEnvFile);
      expect(backupPath).toBeTruthy();
      expect(fs.existsSync(backupPath!)).toBe(true);

      // Corrupt original
      fs.writeFileSync(testEnvFile, 'CORRUPTED_VALUE', 'utf8');

      // Restore
      const restored = restoreEnvBackup(backupPath!, testEnvFile);
      expect(restored).toBe(true);
      expect(fs.readFileSync(testEnvFile, 'utf8')).toBe(initialContent);

      // Cleanup backup
      if (fs.existsSync(backupPath!)) fs.unlinkSync(backupPath!);
    });
  });

  describe('4. Pre-Restart Revalidation Pipeline', () => {
    it('passes validation for valid configuration', async () => {
      const validContent = `
JWT_SECRET=this-is-a-valid-jwt-secret-with-at-least-32-characters
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLu_sample_public_key
VAPID_PRIVATE_KEY=sample_private_key
      `;
      fs.writeFileSync(testEnvFile, validContent, 'utf8');

      const result = await validateEnvConfiguration(testEnvFile, {
        checkJwt: true,
        checkVapid: true,
        testDbConnection: false,
      });

      expect(result.ok).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('detects short or missing JWT_SECRET', async () => {
      const invalidContent = `
JWT_SECRET=short
      `;
      fs.writeFileSync(testEnvFile, invalidContent, 'utf8');

      const result = await validateEnvConfiguration(testEnvFile, {
        checkJwt: true,
        testDbConnection: false,
      });

      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes('demasiado corto'))).toBe(true);
    });

    it('detects unbalanced VAPID keys', async () => {
      const invalidContent = `
JWT_SECRET=this-is-a-valid-jwt-secret-with-at-least-32-characters
NEXT_PUBLIC_VAPID_PUBLIC_KEY=only_public_no_private
      `;
      fs.writeFileSync(testEnvFile, invalidContent, 'utf8');

      const result = await validateEnvConfiguration(testEnvFile, {
        checkJwt: true,
        checkVapid: true,
        testDbConnection: false,
      });

      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes('falta VAPID_PRIVATE_KEY'))).toBe(true);
    });
  });
});
