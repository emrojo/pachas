'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { Cookie, ArrowLeft, CheckCircle2, ShieldCheck, Settings } from 'lucide-react';

export default function CookiesPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-300 hover:text-emerald-600">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.back')}</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm">💸</span>
              <span className="hidden sm:inline">Pachas</span>
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-8">
        <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2">
            <Cookie className="w-3.5 h-3.5" />
            <span>Transparencia y Almacenamiento</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('legal.cookiesTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t('legal.lastUpdated')}
          </p>
        </div>

        {/* Commitment box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm leading-relaxed space-y-2 text-emerald-900 dark:text-emerald-200">
          <div className="font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Compromiso de Privacidad en Cookies:</span>
          </div>
          <p className="text-xs">
            En <strong>Pachas</strong> solo utilizamos <strong>cookies técnicas estrictamente necesarias</strong> y almacenamiento local (<code>sessionStorage</code>) para permitir el inicio de sesión seguro, recordar tus preferencias de idioma y posibilitar el registro de gastos sin conexión a internet (modo offline).
          </p>
          <p className="text-xs font-bold">
            🚫 No utilizamos cookies de seguimiento publicitario, analítica invasiva de terceros ni rastreadores comerciales.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              1. ¿Qué son las Cookies y el Almacenamiento Local?
            </h2>
            <p>
              Una cookie es un pequeño archivo de texto que un sitio web almacena en tu navegador para recordar información sobre tu visita. El almacenamiento local (<code>sessionStorage</code>) es una tecnología estándar que permite a las aplicaciones web guardar datos de forma segura en tu propio dispositivo sin enviarlos continuamente a la red, mejorando la velocidad y permitiendo el funcionamiento sin cobertura (offline).
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              2. Inventario de Cookies y Almacenamiento Utilizado
            </h2>
            <p>A continuación se detallan los elementos técnicos que utiliza Pachas:</p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-3">Nombre / Clave</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Duración</th>
                    <th className="p-3">Finalidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="p-3 font-mono text-emerald-600">sb-access-token</td>
                    <td className="p-3">Cookie Técnica (HTTPOnly)</td>
                    <td className="p-3">7 días</td>
                    <td className="p-3">Autenticación y seguridad de sesión mediante token firmado JWT.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-600">pachas_lang</td>
                    <td className="p-3">Almacenamiento Local</td>
                    <td className="p-3">Persistente</td>
                    <td className="p-3">Recordar tu idioma seleccionado para la interfaz.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-600">pachas_cookie_consent</td>
                    <td className="p-3">Almacenamiento Local</td>
                    <td className="p-3">Persistente</td>
                    <td className="p-3">Registrar que has visto el aviso informativo de cookies.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-emerald-600">pachas_user_v2 / pachas_groups_v2</td>
                    <td className="p-3">Almacenamiento Local</td>
                    <td className="p-3">Persistente</td>
                    <td className="p-3">Copia local cifrada/sanitizada para carga ultra rápida y modo offline.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              3. Ausencia de Cookies de Terceros y Rastreo Publicitario
            </h2>
            <p>
              Pachas es una plataforma independiente y sin publicidad. No integramos píxeles de seguimiento de Meta/Facebook, Google Ads, herramientas de retargeting ni intermediarios comerciales.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              4. ¿Cómo Gestionar o Eliminar las Cookies?
            </h2>
            <p>
              Puedes configurar tu navegador en cualquier momento para bloquear o eliminar las cookies instaladas. Ten en cuenta que si bloqueas las cookies técnicas esenciales, no será posible mantener tu sesión iniciada:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
              <li><strong>Google Chrome:</strong> Configuración &gt; Privacidad y seguridad &gt; Cookies y otros datos de sitios.</li>
              <li><strong>Mozilla Firefox:</strong> Opciones &gt; Privacidad y seguridad &gt; Cookies y datos del sitio.</li>
              <li><strong>Safari (iOS / macOS):</strong> Preferencias &gt; Privacidad &gt; Bloquear todas las cookies.</li>
              <li><strong>Microsoft Edge:</strong> Configuración &gt; Permisos del sitio &gt; Cookies y datos almacenados.</li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
