'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { FileText, ArrowLeft, Shield, AlertTriangle, Scale, Lock, CheckCircle2 } from 'lucide-react';

export default function TermsPage() {
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
            <span>Marco Regulatorio y Legal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('legal.termsTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t('legal.lastUpdated')}
          </p>
        </div>

        {/* Essential Summary Alert */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm leading-relaxed space-y-2 text-emerald-900 dark:text-emerald-200">
          <div className="font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <Shield className="w-4 h-4 shrink-0" />
            <span>Resumen Clave de Protección:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Pachas es una herramienta de cálculo informativo</strong>: No somos una entidad bancaria, no custodiamos fondos ni procesamos transferencias de dinero.</li>
            <li><strong>Responsabilidad del contenido</strong>: Eres el único responsable de las fotos, tickets, textos y ubicaciones que subas a tus grupos.</li>
            <li><strong>Protección de datos sensibles</strong>: Está terminantemente prohibido subir comprobantes con números completos de tarjeta de crédito (PAN) o códigos CVV.</li>
            <li><strong>Privacidad de grupos</strong>: Toda la información compartida es accesible exclusivamente por los miembros que hayan sido invitados al grupo.</li>
          </ul>
        </div>

        {/* Legal Sections */}
        <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              1. Objeto y Ámbito del Servicio
            </h2>
            <p>
              El presente documento regula las condiciones de uso de la aplicación web y móvil <strong>Pachas</strong> (en adelante, la "Plataforma"). Pachas es un software colaborativo diseñado para facilitar el registro, cálculo, reparto equitativo y simplificación de gastos compartidos entre grupos de amigos y particulares durante viajes, vacaciones y eventos comunes.
            </p>
            <p>
              El acceso, registro y utilización de la Plataforma atribuye la condición de Usuario e implica la aceptación plena y sin reservas de todas y cada una de las disposiciones incluidas en estos Términos y en la Política de Privacidad.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              2. Exoneración de Responsabilidad Financiera y Bancaria
            </h2>
            <p>
              <strong>Pachas NO es una entidad de pago, institución de crédito ni proveedor de servicios de pago</strong> conforme a la Directiva de Servicios de Pago (PSD2) ni a la normativa financiera aplicable.
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
              <li>Pachas no gestiona cuentas corrientes, no retiene fondos ni interviene en transacciones monetarias reales.</li>
              <li>Las referencias a "Bizum", "Revolut", "Efectivo" o "Transferencia" son meras opciones de categorización y facilitadores para que los usuarios liquiden sus deudas fuera de la Plataforma a través de sus respectivas entidades financieras.</li>
              <li>El titular de Pachas no asume responsabilidad alguna por impagos, disputas económicas, discrepancias en los repartos o fallos en las transferencias realizadas entre los propios usuarios.</li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              3. Contenido Generado por el Usuario (UGC) y Subida de Tickets
            </h2>
            <p>
              Los usuarios pueden subir y compartir información, descripciones, importes, fotografías de recibos/facturas/tickets de compra y coordenadas GPS en los grupos de los que forman parte.
            </p>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs">
              <strong>⚠️ Obligación de Custodia y Seguridad Bancaria:</strong> El usuario garantiza que los tickets o comprobantes subidos no contienen datos financieros confidenciales de terceros ni números completos de tarjetas de crédito/débito (debe ocultarse el PAN de 16 dígitos y el código CVV).
            </div>
            <p>
              Queda expresamente prohibido subir cualquier contenido que:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
              <li>Infrinja derechos de propiedad intelectual, marcas o secretos comerciales de terceros.</li>
              <li>Sea difamatorio, injurioso, pornográfico, amenazante, racista o incite a la violencia.</li>
              <li>Contenga software malicioso, virus informáticos o enlaces a sitios ilícitos.</li>
              <li>Constituya fraude, simulación de gastos inexistentes o estafa entre particulares.</li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              4. Geolocalización y Registro de Rutas
            </h2>
            <p>
              La función de geolocalización permite asociar una coordenada GPS al lugar donde se realizó un pago para crear un itinerario colaborativo del viaje. La activación del GPS es voluntaria y requiere el consentimiento explícito del usuario a través de los permisos del navegador o dispositivo.
            </p>
            <p>
              Las coordenadas registradas solo son visibles para los miembros invitados al grupo correspondiente y no se comercializan ni se comparten con redes publicitarias de terceros.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              5. Exclusión de Responsabilidad por Actos de Otros Usuarios
            </h2>
            <p>
              El titular de Pachas actúa como un mero prestador de servicios de intermediación de la sociedad de la información. Conforme a la legislación vigente (LSSI-CE y Reglamento de Servicios Digitales de la UE):
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
              <li>No nos responsabilizamos de las opiniones, tickets falsificados, conductas abusivas o contenidos ilícitos que los usuarios puedan compartir en sus grupos.</li>
              <li>Cada usuario es el único responsable legal y civil frente a los demás miembros del grupo y frente a terceros por los datos que introduzca en la Plataforma.</li>
            </ul>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              6. Mecanismo de Denuncia, Moderación y Baja de Cuentas
            </h2>
            <p>
              Cualquier usuario puede reportar un gasto, comprobante o perfil que considere ilícito o que vulnere su privacidad mediante el botón de <strong>"Reportar Contenido"</strong> disponible en la aplicación o contactando por correo electrónico.
            </p>
            <p>
              El equipo de administración de Pachas se reserva el derecho de retirar cautelarmente cualquier contenido denunciado y de suspender o cancelar unilateralmente el acceso a aquellos usuarios que incumplan reiteradamente las presentes condiciones.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              7. Licencia Técnica sobre Contenidos
            </h2>
            <p>
              El usuario conserva la titularidad de todos los derechos de propiedad intelectual sobre las imágenes y datos que sube. No obstante, al cargarlos en la Plataforma, concede a Pachas una licencia no exclusiva, gratuita y mundial para almacenar, procesar, redimensionar y mostrar técnicamente dichos contenidos a los integrantes del grupo al que pertenezcan con el único fin de prestar el servicio.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              8. Modificaciones y Ley Aplicable
            </h2>
            <p>
              Pachas se reserva el derecho a actualizar o modificar estos Términos en cualquier momento para adaptarlos a novedades legislativas o mejoras técnicas.
            </p>
            <p>
              Las presentes Condiciones se rigen por la legislación española y comunitaria europea. Para la resolución de cualquier litigio derivado del uso de la Plataforma, las partes se someten a los juzgados y tribunales del domicilio del usuario cuando ostente la condición de consumidor.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
