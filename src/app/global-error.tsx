'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error:', error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen flex items-center justify-center p-4 bg-slate-900 text-white font-sans">
        <div className="max-w-md w-full text-center bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/50 text-rose-500 flex items-center justify-center text-3xl mx-auto mb-4">
            🛑
          </div>
          <h2 className="text-xl font-bold mb-2">Error del Sistema</h2>
          <p className="text-sm text-slate-400 mb-6">
            Se ha producido un error crítico. Haz clic en el botón para reintentar la carga.
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md transition-colors text-sm"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
