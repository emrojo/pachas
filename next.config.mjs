/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Content Security Policy (CSP)
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://maps.googleapis.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com blob:;
  script-src-elem 'self' 'unsafe-inline' https://unpkg.com https://maps.googleapis.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com blob:;
  worker-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com;
  child-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
  img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://maps.googleapis.com https://maps.gstatic.com https://unpkg.com;
  font-src 'self' https://fonts.gstatic.com data:;
  connect-src 'self' https: wss: blob: data: https://nominatim.openstreetmap.org https://maps.googleapis.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com http://localhost:* ws://localhost:*;
  frame-src 'self' https://maps.google.com https://www.google.com;
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

