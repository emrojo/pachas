'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { Shield, ArrowLeft, Lock, Database, Eye, UserCheck, Download, Trash2 } from 'lucide-react';

export default function PrivacyPage() {
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
            <Shield className="w-3.5 h-3.5" />
            <span>Cumplimiento RGPD & LOPDGDD</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('legal.privacyTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t('legal.lastUpdated')}
          </p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">Grupos Cerrados</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Tus tickets, gastos y ubicaciones solo son visibles para los amigos que invites expresamente a tu grupo.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">Cero Publicidad</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              No vendemos tus datos a intermediarios ni utilizamos cookies de seguimiento publicitario de terceros.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">Control Total</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Descarga una copia completa de tus datos (JSON) o elimina tu cuenta definitivamente en 1 clic desde tu perfil.
            </p>
          </div>
        </div>

        {/* Legal Text */}
        <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              1. Responsable del Tratamiento de tus Datos
            </h2>
            <p>
              El titular y responsable del tratamiento de los datos personales recabados a través de <strong>Pachas</strong> es el administrador del servicio (en adelante, el "Responsable"), en cumplimiento del Reglamento General de Protección de Datos (RGPD UE 2016/679) y la Ley Orgánica 3/2018 (LOPDGDD).
            </p>
            <p>
              Para cualquier consulta sobre privacidad o para el ejercicio de derechos, puedes escribirnos al correo electrónico configurado en la plataforma o contactar al administrador del sistema.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              2. Categorías de Datos que Tratamos y Finalidad
            </h2>
            <p>Recopilamos únicamente los datos estrictamente necesarios para proporcionarte el servicio de reparto de gastos:</p>
            <div className="space-y-2 pl-2">
              <div>
                <strong>a) Datos de Cuenta y Registro:</strong>
                <p className="text-slate-500 text-xs mt-0.5">
                  Nombre completo, correo electrónico y contraseña (almacenada mediante funciones de hash criptográfico irreversible PBKDF2/HMAC-SHA512). Finalidad: gestionar tu cuenta, autenticación y acceso a tus grupos.
                </p>
              </div>
              <div>
                <strong>b) Datos de Contacto y Liquidación (Teléfono Bizum):</strong>
                <p className="text-slate-500 text-xs mt-0.5">
                  Número de teléfono opcional para facilitar que los integrantes del grupo copien tu número en 1 clic para realizarte pagos por Bizum.
                </p>
              </div>
              <div>
                <strong>c) Datos de Geolocalización GPS:</strong>
                <p className="text-slate-500 text-xs mt-0.5">
                  Coordenadas geográficas y nombres de locales de los gastos cuando activas voluntariamente la casilla de ubicación. Finalidad: trazar el itinerario y mapa de ruta colaborativo de vuestro viaje.
                </p>
              </div>
              <div>
                <strong>d) Imágenes y Comprobantes (Tickets y Facturas):</strong>
                <p className="text-slate-500 text-xs mt-0.5">
                  Fotografías de tickets o justificantes de compra que adjuntas a los gastos. Finalidad: permitir la comprobación de los conceptos entre los amigos del grupo.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              3. Base Jurídica del Tratamiento
            </h2>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
              <li><strong>Ejecución del contrato / prestación del servicio (Art. 6.1.b RGPD)</strong>: Para gestionar tu registro, calcular los saldos del grupo y mantener tus registros sincronizados.</li>
              <li><strong>Consentimiento explícito (Art. 6.1.a RGPD)</strong>: Para la geolocalización GPS y la subida de fotografías de tickets o comprobantes.</li>
              <li><strong>Interés legítimo (Art. 6.1.f RGPD)</strong>: Para prevenir el fraude, salvaguardar la seguridad del sistema y atender reportes de abuso.</li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              4. Destinatarios y Privacidad de los Grupos
            </h2>
            <p>
              Tus datos de gastos, tickets y ubicaciones <strong>solo son compartidos con los usuarios que forman parte de los mismos grupos que tú</strong> mediante enlaces de invitación exclusivos.
            </p>
            <p>
              Pachas no comercializa, no alquila ni cede tus datos personales a redes de publicidad, corredores de datos ni terceros para fines comerciales.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              5. Medidas de Seguridad Técnicas y Organizativas
            </h2>
            <p>
              Aplicamos medidas de seguridad de vanguardia para salvaguardar tu información:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
              <li>Cifrado de comunicaciones mediante protocolos HTTPS/TLS.</li>
              <li>Almacenamiento de contraseñas con salting aleatorio y hash seguro (PBKDF2 / SHA-512).</li>
              <li>Sesiones protegidas con tokens criptográficos JWT firmados (HMAC-SHA256).</li>
              <li>Sanitización automática de entradas contra ataques XSS e inyecciones SQL.</li>
              <li>Compresión y saneamiento de imágenes antes del almacenamiento.</li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              6. Ejercicio de tus Derechos RGPD (ARCO+)
            </h2>
            <p>
              Conforme a la normativa europea, tienes derecho a acceder, rectificar, suprimir, limitar y portar tus datos:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Portabilidad de Datos</span>
                </div>
                <p className="text-xs text-slate-500">
                  Puedes descargar en cualquier momento una copia estructurada en formato JSON con todos tus datos desde la sección <em>Mi Perfil</em>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Derecho al Olvido / Supresión</span>
                </div>
                <p className="text-xs text-slate-500">
                  Puedes eliminar permanentemente tu cuenta y desvincular tus datos personales de manera autónoma e irreversible desde <em>Mi Perfil</em>.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              7. Conservación de los Datos
            </h2>
            <p>
              Tus datos se conservarán mientras mantengas activa tu cuenta en la Plataforma. Al solicitar la baja definitiva de tu cuenta, tus datos personales serán suprimidos o anonimizados de forma que no sea posible tu identificación posterior.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
