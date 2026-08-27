import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getLiveDonationUrl(): string {
  let username =
    process.env.BUYMEACOFFEE_USERNAME ||
    process.env.NEXT_PUBLIC_BUYMEACOFFEE_USERNAME;
  let customUrl =
    process.env.BUYMEACOFFEE_URL ||
    process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL;

  // If not found in process.env, check .env files on the server directly
  if (!username && !customUrl) {
    const envFiles = [
      path.join(process.cwd(), 'deploy', '.env.production'),
      path.join(process.cwd(), '.env.production'),
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
    ];

    for (const file of envFiles) {
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const [k, ...v] = trimmed.split('=');
            const val = v.join('=').trim().replace(/^["']|["']$/g, '');
            if (k === 'BUYMEACOFFEE_USERNAME' || k === 'NEXT_PUBLIC_BUYMEACOFFEE_USERNAME') {
              if (val) username = val;
            }
            if (k === 'BUYMEACOFFEE_URL' || k === 'NEXT_PUBLIC_BUYMEACOFFEE_URL') {
              if (val) customUrl = val;
            }
          }
        } catch {}
      }
    }
  }

  if (customUrl) {
    return customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
  }

  username = username || 'emrojo';
  return `https://www.buymeacoffee.com/${username}`;
}

export async function GET() {
  const url = getLiveDonationUrl();
  return NextResponse.json({ url });
}
