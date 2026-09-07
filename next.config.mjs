import fs from 'fs';
import path from 'path';

// Carga automática de variables de producción desde deploy/.env.production si existen
const rootDir = process.cwd();
const candidateEnvFiles = [
  path.join(rootDir, 'deploy', '.env.production'),
  path.join(rootDir, '.env.production'),
  path.join(rootDir, 'deploy', '.env'),
  path.join(rootDir, 'deploy', '.env.local'),
];

for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // Ignorar errores no críticos de lectura
    }
  }
}

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Content Security Policy (CSP)
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://maps.googleapis.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://accounts.google.com blob:;
  script-src-elem 'self' 'unsafe-inline' https://unpkg.com https://maps.googleapis.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://accounts.google.com blob:;
  worker-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com;
  child-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://accounts.google.com;
  img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://maps.googleapis.com https://maps.gstatic.com https://unpkg.com;
  font-src 'self' https://fonts.gstatic.com data:;
  connect-src 'self' https: wss: blob: data: https://nominatim.openstreetmap.org https://maps.googleapis.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com http://localhost:* ws://localhost:*;
  frame-src 'self' https://maps.google.com https://www.google.com https://accounts.google.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  ${isProd ? 'upgrade-insecure-requests;' : ''}
`.replace(/\s{2,}/g, ' ').trim();


const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspHeader,
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(self)',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
];

const nextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  },
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['pg'],
  images: {

    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

