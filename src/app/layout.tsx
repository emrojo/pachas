import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PachasProvider } from '@/context/PachasContext';
import { LanguageProvider } from '@/context/LanguageContext';

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
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <LanguageProvider>
          <PachasProvider>
            {children}
          </PachasProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

