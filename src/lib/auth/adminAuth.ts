import fs from 'fs';
import path from 'path';

export function getAdminEmails(): Set<string> {
  const adminSet = new Set<string>();

  const addEmail = (raw?: string) => {
    if (!raw) return;
    const parts = raw.split(/[,;\s]+/);
    for (const part of parts) {
      const clean = part.trim().replace(/^["']|["']$/g, '').trim().toLowerCase();
      if (clean && clean.includes('@') && !clean.startsWith('example')) {
        adminSet.add(clean);
      }
    }
  };

  // 1. Direct process.env check
  addEmail(process.env.ADMIN_EMAIL);
  addEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL);

  // 2. Direct filesystem read from deploy/.env.production, .env.production, etc. (Node.js runtime)
  if (typeof process !== 'undefined' && process.cwd) {
    const candidatePaths = [
      path.resolve(process.cwd(), 'deploy/.env.production'),
      path.resolve(process.cwd(), '.env.production'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), 'deploy/.env'),
      path.resolve(process.cwd(), '.env'),
      '/app/deploy/.env.production',
      '/app/.env.production',
      '/app/.env.local',
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(/* turbopackIgnore: true */ p)) {
          const fileContent = fs.readFileSync(/* turbopackIgnore: true */ p, 'utf-8');
          const m1 = fileContent.match(/^\s*ADMIN_EMAIL\s*=\s*(?:["']?)([^#\r\n"']+)(?:["']?)/m);
          if (m1 && m1[1]) addEmail(m1[1]);
          const m2 = fileContent.match(/^\s*NEXT_PUBLIC_ADMIN_EMAIL\s*=\s*(?:["']?)([^#\r\n"']+)(?:["']?)/m);
          if (m2 && m2[1]) addEmail(m2[1]);
        }
      } catch {}
    }
  }

  return adminSet;
}

export function isServerAdmin(email?: string, userId?: string, role?: string): boolean {
  if (role === 'admin') return true;

  if (email) {
    const clean = email.trim().toLowerCase();
    const adminEmails = getAdminEmails();
    if (adminEmails.has(clean)) return true;
  }

  // Demo mode fallback
  const isDemo = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEMO_USERS === 'true';
  if (isDemo) {
    if (userId === 'user-1' || email === 'ana@example.com' || email === 'admin@pachas.app') {
      return true;
    }
  }

  return false;
}
