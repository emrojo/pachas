'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { Scale, ArrowLeft, Building, ShieldAlert, Cpu, Code2, ArrowRight } from 'lucide-react';

export default function LegalNoticePage() {
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
            <Scale className="w-3.5 h-3.5" />
            <span>Cumplimiento LSSI-CE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('legal.legalNoticeTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t('legal.lastUpdated')}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" />
              1. Datos Identificativos del Prestador
            </h2>
            <p>
              En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que la plataforma web y aplicación <strong>Pachas</strong> es un proyecto tecnológico independiente puesto a disposición de los usuarios para la gestión y reparto colaborativo de gastos entre particulares.
            </p>
            <p>
              Para cualquier comunicación oficial, notificación legal o reporte de seguridad, los usuarios pueden dirigirse a través de los canales de soporte habilitados en la plataforma o al correo electrónico de administración configurado.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              2. Propiedad Intelectual e Industrial
            </h2>
            <p>
              El código fuente, arquitectura de software, diseño gráfico, logotipos, marcas, algoritmos de optimización de deudas (Debt Simplification Engine), textos e interfaces que componen Pachas son propiedad exclusiva de sus respectivos autores o cuentan con las preceptivas licencias de código abierto, estando protegidos por la legislación española e internacional sobre propiedad intelectual e industrial.
            </p>
            <p>
              Queda expresamente prohibida la reproducción, distribución, comunicación pública o descompilación no autorizada fuera del marco expresamente concedido por las licencias correspondientes.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              3. Limitación de Responsabilidad y Exclusión de Garantías
            </h2>
            <p>
              El prestador del servicio realiza los máximos esfuerzos técnicos para garantizar la continuidad, exactitud de los cálculos y seguridad de la Plataforma. No obstante:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
              <li>El software se proporciona "tal cual" y según disponibilidad, sin garantías implícitas sobre la adecuación a un fin particular o ausencia ininterrumpida de errores.</li>
              <li>Pachas no se responsabiliza de posibles interrupciones por mantenimiento técnico de servidores, cortes en servicios de terceros (APIs de mapas o alojamiento) ni pérdidas de datos fortuitas. Se recomienda a los usuarios mantener copias de seguridad de sus comprobantes físicos relevantes.</li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              4. Legislación y Jurisdicción
            </h2>
            <p>
              Las relaciones entre el titular de Pachas y los usuarios se regirán por la normativa vigente en España y la Unión Europea. Para la resolución de cualesquiera controversias que pudieran suscitarse, ambas partes se someten a los juzgados y tribunales competentes conforme a derecho.
            </p>
          </section>

          <section className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-600" />
              5. Librerías de Terceros, Software Libre y Atribuciones Legales
            </h2>
            <p>
              Pachas integra software de código abierto y utiliza servicios de terceros bajo sus respectivas licencias públicas (MIT, Apache 2.0, BSD-2-Clause, ISC, CC0 1.0, ODbL, entre otras). En estricto cumplimiento de los términos de propiedad intelectual y avisos de copyright exigidos por cada titular, se encuentra disponible un registro completo de todas las librerías, dependencias, autores y términos de licenciamiento.
            </p>
            <div className="pt-1">
              <Link
                href="/licenses"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors"
              >
                <span>Consultar Catálogo Oficial de Licencias y Librerías de Terceros</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
