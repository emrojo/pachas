'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import {
  Code2,
  ExternalLink,
  Search,
  Check,
  Shield,
  Layers,
  MapPin,
  FileScan,
  Database,
  Globe,
  Sparkles,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface ThirdPartyLibrary {
  name: string;
  category: 'core' | 'mobile' | 'maps' | 'ocr' | 'backend' | 'services';
  license: string;
  author: string;
  purpose: string;
  purposeEn: string;
  url: string;
  licenseUrl: string;
  licenseText?: string;
}

export const THIRD_PARTY_LIBRARIES: ThirdPartyLibrary[] = [
  // 1. Frameworks, Core & UI
  {
    name: 'Next.js',
    category: 'core',
    license: 'MIT',
    author: 'Vercel, Inc.',
    purpose: 'Framework full-stack con React Server Components, App Router, SSR y optimización de activos.',
    purposeEn: 'Full-stack framework with React Server Components, App Router, SSR, and asset optimization.',
    url: 'https://nextjs.org',
    licenseUrl: 'https://github.com/vercel/next.js/blob/canary/license.md',
  },
  {
    name: 'React & React DOM',
    category: 'core',
    license: 'MIT',
    author: 'Meta Platforms, Inc. & React Team',
    purpose: 'Biblioteca fundamental para el renderizado declarativo y gestión reactiva de interfaces de usuario.',
    purposeEn: 'Core library for declarative rendering and reactive user interface management.',
    url: 'https://react.dev',
    licenseUrl: 'https://github.com/facebook/react/blob/main/LICENSE',
  },
  {
    name: 'TypeScript',
    category: 'core',
    license: 'Apache-2.0',
    author: 'Microsoft Corporation',
    purpose: 'Tipado estático seguro y compilador de código para robustez y prevención de errores en tiempo de desarrollo.',
    purposeEn: 'Static type checking and compiler ensuring code robustness and compile-time error prevention.',
    url: 'https://www.typescriptlang.org',
    licenseUrl: 'https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt',
  },
  {
    name: 'Tailwind CSS',
    category: 'core',
    license: 'MIT',
    author: 'Tailwind Labs, Inc.',
    purpose: 'Sistema de diseño basado en clases de utilidad para estilos modernos, consistentes y modo oscuro nativo.',
    purposeEn: 'Utility-first CSS framework for modern, consistent UI design and native dark mode support.',
    url: 'https://tailwindcss.com',
    licenseUrl: 'https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE',
  },
  {
    name: 'Lucide Icons (lucide-react)',
    category: 'core',
    license: 'ISC',
    author: 'Lucide Project & Cole Bemis',
    purpose: 'Conjunto de iconos vectoriales SVG consistentes, accesibles y de alto rendimiento.',
    purposeEn: 'Consistent, accessible, and high-performance SVG vector icons.',
    url: 'https://lucide.dev',
    licenseUrl: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE',
  },
  {
    name: 'Framer Motion',
    category: 'core',
    license: 'MIT',
    author: 'Framer B.V.',
    purpose: 'Motor de animaciones declarativas para transiciones de páginas, modales y micro-interacciones.',
    purposeEn: 'Declarative animation engine powering page transitions, modals, and micro-interactions.',
    url: 'https://www.framer.com/motion',
    licenseUrl: 'https://github.com/framer/motion/blob/main/LICENSE.md',
  },
  {
    name: 'Canvas Confetti',
    category: 'core',
    license: 'ISC',
    author: 'Kiril Vatev',
    purpose: 'Efectos visuales festivos de confeti al liquidar deudas, saldar gastos o crear nuevos grupos.',
    purposeEn: 'Celebratory confetti visual effects when settling debts, balancing expenses, or creating groups.',
    url: 'https://www.kirilv.com/canvas-confetti/',
    licenseUrl: 'https://github.com/catdad/canvas-confetti/blob/master/LICENSE',
  },
  {
    name: 'clsx & tailwind-merge & class-variance-authority',
    category: 'core',
    license: 'MIT',
    author: 'Luke Edwards, Dany Chuprin, Joe Bell',
    purpose: 'Composición condicional y resolución sin conflictos de clases CSS dinámicas.',
    purposeEn: 'Conditional composition and conflict-free merging of dynamic CSS utility classes.',
    url: 'https://github.com/lukeed/clsx',
    licenseUrl: 'https://github.com/lukeed/clsx/blob/master/license',
  },

  // 2. Mobile & Native
  {
    name: 'Capacitor (Core, Android, iOS)',
    category: 'mobile',
    license: 'MIT',
    author: 'Ionic / Drifty Co.',
    purpose: 'Puente nativo para empaquetar y ejecutar la aplicación como app nativa en Android e iOS.',
    purposeEn: 'Cross-platform runtime to deploy Pachas as a high-performance native iOS and Android app.',
    url: 'https://capacitorjs.com',
    licenseUrl: 'https://github.com/ionic-team/capacitor/blob/main/LICENSE',
  },
  {
    name: 'Capacitor Plugins (Haptics, Share, StatusBar, SplashScreen, Filesystem)',
    category: 'mobile',
    license: 'MIT',
    author: 'Ionic / Drifty Co. & Contributors',
    purpose: 'Integración con APIs nativas del dispositivo: vibración háptica, compartir comprobantes, barra de estado y archivos.',
    purposeEn: 'Device hardware API integration: haptic feedback, native share sheet, status bar, and filesystem storage.',
    url: 'https://capacitorjs.com/docs/plugins',
    licenseUrl: 'https://github.com/ionic-team/capacitor-plugins/blob/main/LICENSE',
  },

  // 3. Maps & Geolocation
  {
    name: 'Leaflet (leaflet)',
    category: 'maps',
    license: 'BSD-2-Clause',
    author: 'Vladimir Agafonkin, CloudMade',
    purpose: 'Motor ligero de mapas interactivos para visualización de ubicaciones de compras y rutas de viaje.',
    purposeEn: 'Lightweight interactive mapping library for viewing expense locations and trip routes.',
    url: 'https://leafletjs.com',
    licenseUrl: 'https://github.com/Leaflet/Leaflet/blob/main/LICENSE',
  },
  {
    name: 'OpenStreetMap Tile Data',
    category: 'maps',
    license: 'ODbL',
    author: '© OpenStreetMap contributors',
    purpose: 'Cartografía geográfica global y teselas de mapa libres de derechos para geolocalización de gastos.',
    purposeEn: 'Open geographic data and map tiles for global expense geolocation and route visualization.',
    url: 'https://www.openstreetmap.org/copyright',
    licenseUrl: 'https://www.openstreetmap.org/copyright',
  },

  // 4. OCR & Document Processing
  {
    name: 'Tesseract.js',
    category: 'ocr',
    license: 'Apache-2.0',
    author: 'Jerome Wu & Tesseract OCR team',
    purpose: 'Reconocimiento óptico de caracteres (OCR) ejecutado en cliente vía WebAssembly para extraer importes de tickets.',
    purposeEn: 'Client-side optical character recognition (OCR) via WebAssembly to extract totals and dates from receipts.',
    url: 'https://tesseract.projectnaptha.com',
    licenseUrl: 'https://github.com/naptha/tesseract.js/blob/master/LICENSE',
  },
  {
    name: 'PDF.js (pdfjs-dist)',
    category: 'ocr',
    license: 'Apache-2.0',
    author: 'Mozilla Foundation',
    purpose: 'Renderizado y lectura de documentos y facturas en formato PDF en el navegador.',
    purposeEn: 'Standards-compliant rendering and parsing of PDF documents and receipts inside the browser.',
    url: 'https://mozilla.github.io/pdf.js/',
    licenseUrl: 'https://github.com/mozilla/pdf.js/blob/master/LICENSE',
  },
  {
    name: 'jsPDF & jsPDF-AutoTable',
    category: 'ocr',
    license: 'MIT',
    author: 'James Hall, Simon Tenggren & Contributors',
    purpose: 'Generación y exportación de informes oficiales, balances contables y auditorías de grupo en PDF.',
    purposeEn: 'Client-side PDF document generation for accounting balance sheets, expense reports, and audits.',
    url: 'https://github.com/parallax/jsPDF',
    licenseUrl: 'https://github.com/parallax/jsPDF/blob/master/LICENSE',
  },

  // 5. Backend & Communications
  {
    name: 'node-postgres (pg)',
    category: 'backend',
    license: 'MIT',
    author: 'Brian Carlson & Contributors',
    purpose: 'Controlador de base de datos PostgreSQL, soporte transaccional y pool de conexiones resiliente.',
    purposeEn: 'PostgreSQL database driver providing connection pooling, transactional queries, and data persistence.',
    url: 'https://node-postgres.com',
    licenseUrl: 'https://github.com/brianc/node-postgres/blob/master/LICENSE',
  },
  {
    name: 'Supabase JS Client (@supabase/supabase-js, @supabase/ssr)',
    category: 'backend',
    license: 'MIT',
    author: 'Supabase, Inc.',
    purpose: 'Cliente para sincronización en la nube, autenticación y base de datos relacional PostgreSQL.',
    purposeEn: 'SDK for cloud data sync, session authentication, and PostgreSQL database queries.',
    url: 'https://supabase.com',
    licenseUrl: 'https://github.com/supabase/supabase-js/blob/master/LICENSE',
  },
  {
    name: 'Web-Push (web-push)',
    category: 'backend',
    license: 'MIT',
    author: 'Marco Castelluccio & Contributors',
    purpose: 'Protocolo de notificaciones Push conforme al estándar web W3C con cifrado VAPID.',
    purposeEn: 'Web Push protocol library with VAPID cryptographic signing for cross-platform push notifications.',
    url: 'https://github.com/web-push-libs/web-push',
    licenseUrl: 'https://github.com/web-push-libs/web-push/blob/master/LICENSE',
  },
  {
    name: 'Nodemailer',
    category: 'backend',
    license: 'MIT-0',
    author: 'Andris Reinman',
    purpose: 'Envío de correos transaccionales para recuperación de contraseñas y avisos administrativos.',
    purposeEn: 'Transactional email delivery for password resets, invitations, and administrative notices.',
    url: 'https://nodemailer.com',
    licenseUrl: 'https://github.com/nodemailer/nodemailer/blob/master/LICENSE',
  },
  {
    name: 'qrcode.react',
    category: 'backend',
    license: 'ISC',
    author: 'Paul O’Shannessy & zpao',
    purpose: 'Generación de códigos QR vectoriales para enlaces de invitación instantáneos a grupos.',
    purposeEn: 'Vector QR code generator for instant group invitation links and mobile pairing.',
    url: 'https://github.com/zpao/qrcode.react',
    licenseUrl: 'https://github.com/zpao/qrcode.react/blob/master/LICENSE',
  },
  {
    name: 'date-fns',
    category: 'backend',
    license: 'MIT',
    author: 'Sasha Koss & Lesha Koss',
    purpose: 'Utilidades de manipulación, comparación y formateo de fechas con soporte internacional.',
    purposeEn: 'Comprehensive date and time arithmetic, formatting, and internationalization utilities.',
    url: 'https://date-fns.org',
    licenseUrl: 'https://github.com/date-fns/date-fns/blob/main/LICENSE.md',
  },

  // 6. External APIs & Web Services
  {
    name: 'Pexels API',
    category: 'services',
    license: 'Pexels License / API Terms',
    author: 'Pexels GmbH / Canva',
    purpose: 'Banco de imágenes y portadas de viajes de alta calidad con atribución directa a fotógrafos colaboradores.',
    purposeEn: 'High-quality travel photography and group cover imagery with direct photographer attribution.',
    url: 'https://www.pexels.com',
    licenseUrl: 'https://www.pexels.com/license/',
  },
  {
    name: 'DiceBear Avatar Engine',
    category: 'services',
    license: 'CC0 1.0 Universal / MIT',
    author: 'Florian Körner, Pablo Stanley & Design Contributors',
    purpose: 'Generación de avatares vectoriales personalizables (Lorelei, Bottts, Avataaars, Adventurer, Micah, etc.).',
    purposeEn: 'Customizable vector avatar generator featuring styles by Florian Körner, Pablo Stanley, and contributing artists.',
    url: 'https://www.dicebear.com',
    licenseUrl: 'https://github.com/dicebear/dicebear/blob/main/LICENSE',
  },
  {
    name: 'Google Gemini 1.5 Flash API',
    category: 'services',
    license: 'Google Cloud Terms of Service',
    author: 'Google LLC',
    purpose: 'Servicio de visión artificial e inteligencia artificial para escaneo y estructuración automática de tickets.',
    purposeEn: 'Generative AI vision service for automated receipt scanning, parsing, and structured data extraction.',
    url: 'https://ai.google.dev',
    licenseUrl: 'https://policies.google.com/terms',
  },
  {
    name: 'Open Exchange Rates API',
    category: 'services',
    license: 'Open Exchange Rates Terms',
    author: 'Open Exchange Rates Ltd.',
    purpose: 'Cotizaciones oficiales y tipos de cambio en tiempo real entre más de 160 divisas internacionales.',
    purposeEn: 'Real-time and historical currency exchange rate quotes across 160+ international currencies.',
    url: 'https://openexchangerates.org',
    licenseUrl: 'https://openexchangerates.org/terms',
  },
  {
    name: 'Buy Me a Coffee Platform',
    category: 'services',
    license: 'Buy Me a Coffee Terms',
    author: 'Buy Me a Coffee, Inc.',
    purpose: 'Plataforma externa para aportaciones y donaciones voluntarias de soporte al desarrollo del proyecto.',
    purposeEn: 'External creator support platform for optional user donations supporting project maintenance.',
    url: 'https://buymeacoffee.com',
    licenseUrl: 'https://www.buymeacoffee.com/terms',
  },
];

const CATEGORIES = [
  { id: 'all', labelEs: 'Todas las Librerías', labelEn: 'All Libraries', icon: Layers },
  { id: 'core', labelEs: 'Framework & Interfaz', labelEn: 'Framework & UI', icon: Code2 },
  { id: 'mobile', labelEs: 'Móvil y Nativo', labelEn: 'Mobile & Native', icon: Smartphone },
  { id: 'maps', labelEs: 'Mapas y Geolocalización', labelEn: 'Maps & Geolocation', icon: MapPin },
  { id: 'ocr', labelEs: 'OCR y Documentos', labelEn: 'OCR & Documents', icon: FileScan },
  { id: 'backend', labelEs: 'Backend y Base de Datos', labelEn: 'Backend & Database', icon: Database },
  { id: 'services', labelEs: 'APIs y Servicios Web', labelEn: 'APIs & Web Services', icon: Globe },
];

export const ThirdPartyLicenses: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language } = useTranslation();
  const isEn = language === 'en';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLicenseType, setSelectedLicenseType] = useState<string>('all');

  // Distinct licenses list
  const availableLicenses = useMemo(() => {
    const set = new Set<string>();
    THIRD_PARTY_LIBRARIES.forEach((l) => set.add(l.license));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    return THIRD_PARTY_LIBRARIES.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchLic = selectedLicenseType === 'all' || item.license === selectedLicenseType;
      const query = search.trim().toLowerCase();
      const matchSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query) ||
        item.license.toLowerCase().includes(query) ||
        item.purpose.toLowerCase().includes(query) ||
        item.purposeEn.toLowerCase().includes(query);

      return matchCat && matchLic && matchSearch;
    });
  }, [search, selectedCategory, selectedLicenseType]);

  return (
    <div className={`space-y-6 w-full ${className}`}>
      {/* Introduction Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
            <Shield className="w-3.5 h-3.5" />
            <span>{isEn ? 'Open Source & Third-Party Attribution' : 'Software Libre y Atribución de Terceros'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {isEn ? 'Third-Party Software & Open-Source Licenses' : 'Librerías de Terceros y Licencias de Código Abierto'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
            {isEn
              ? 'Pachas is built using open-source libraries and third-party APIs. We are deeply grateful to all developers, open-source communities, and contributors who make these robust tools available. This page fulfills our legal obligation to provide copyright notices and license attributions pursuant to international software licensing terms.'
              : 'Pachas está construida gracias al ecosistema de código abierto y a servicios de terceros. Agradecemos profundamente la labor de todos los autores, comunidades y mantenedores. Esta sección da cumplimiento formal a los términos de atribución de derechos de autor y licencias de software libre (MIT, Apache 2.0, BSD, ISC, CC0, ODbL, etc.).'}
          </p>
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isEn ? 'Search library, author, or license...' : 'Buscar librería, autor o licencia...'}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
          />
        </div>

        {/* License Filter */}
        <div className="shrink-0">
          <select
            value={selectedLicenseType}
            onChange={(e) => setSelectedLicenseType(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2.5 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold cursor-pointer"
          >
            <option value="all">{isEn ? 'All Licenses' : 'Todas las Licencias'}</option>
            {availableLicenses.map((lic) => (
              <option key={lic} value={lic}>
                {lic}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{isEn ? cat.labelEn : cat.labelEs}</span>
            </button>
          );
        })}
      </div>

      {/* Libraries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.name}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {item.author}
                  </p>
                </div>

                <span className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                  {item.license}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isEn ? item.purposeEn : item.purpose}
              </p>
            </div>

            {/* Links Row */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <span>{isEn ? 'Official Website / Repo' : 'Sitio Oficial / Repo'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={item.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <span>{isEn ? 'View License' : 'Ver Licencia'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <Layers className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isEn ? 'No third-party libraries found' : 'No se encontraron librerías con los filtros seleccionados'}
          </p>
          <p className="text-xs text-slate-400">
            {isEn ? 'Try adjusting your search terms or category.' : 'Prueba a cambiar el texto de búsqueda o la categoría.'}
          </p>
        </div>
      )}

      {/* Mandatory Disclaimer Clause */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1.5">
        <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>{isEn ? 'Warranty Disclaimer for Open-Source Software' : 'Exención de Garantía sobre Software de Terceros'}</span>
        </p>
        <p>
          {isEn
            ? 'All third-party libraries and components are provided by their respective copyright holders "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY.'
            : 'Todas las librerías, dependencias y paquetes de terceros son proporcionados por sus respectivos titulares de derechos de autor "TAL CUAL", SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS, INCLUIDAS LAS GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN FIN DETERMINADO O NO INFRACCIÓN. EN NINGÚN CASO LOS AUTORES O TITULARES DE DERECHOS SERÁN RESPONSABLES POR CUALQUIER RECLAMACIÓN O DAÑO DERIVADO DE SU USO.'}
        </p>
      </div>
    </div>
  );
};
