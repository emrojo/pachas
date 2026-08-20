import type { Metadata } from 'next';
import './globals.css';
import { PachasProvider } from '@/context/PachasContext';

export const metadata: Metadata = {
  title: 'Pachas — Comparte gastos de vacaciones con amigos',
  description:
    'La app más fácil para dividir gastos de viajes, hoteles, cenas y alquileres con amigos a partes iguales o personalizadas.',
  manifest: '/manifest.json',
  themeColor: '#10b981',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <PachasProvider>
          {children}
        </PachasProvider>
      </body>
    </html>
  );
}
