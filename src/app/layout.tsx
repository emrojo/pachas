import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { PachasProvider } from '@/context/PachasContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#059669' },
    { media: '(prefers-color-scheme: dark)', color: '#022c22' },
  ],
};

export const metadata: Metadata = {
  title: 'Pachas — Comparte gastos de vacaciones con amigos',
  description:
    'La app más fácil para dividir gastos de viajes, hoteles, cenas y alquileres con amigos a partes iguales o personalizadas.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pachas',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth" suppressHydrationWarning>
      <body
        className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-500 selection:text-white"
        suppressHydrationWarning
      >
        <LanguageProvider>
          <PachasProvider>
            {children}
            <CookieConsentBanner />
            <ServiceWorkerRegister />
          </PachasProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

