'use client';

import React, { useState } from 'react';
import { Search, X, Film, Sparkles, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

export interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
}

interface GifItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  category: string;
  tags: string[];
}

const CURATED_GIFS: GifItem[] = [
  // Celebración y Fiesta
  {
    id: 'gif-party-1',
    title: 'Celebración fiesta',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif',
    category: 'party',
    tags: ['fiesta', 'party', 'celebracion', 'baile', 'copas'],
  },
  {
    id: 'gif-cheers-leo',
    title: 'Brindis Gatsby',
    url: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/200w.gif',
    category: 'party',
    tags: ['brindis', 'cheers', 'champagne', 'celebrar', 'gatsby'],
  },
  {
    id: 'gif-confetti',
    title: 'Confeti y fiesta',
    url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/200w.gif',
    category: 'party',
    tags: ['confeti', 'felicidades', 'victoria', 'hurra'],
  },

  // Dinero y Pagos
  {
    id: 'gif-money-rain',
    title: 'Lluvia de billetes',
    url: 'https://media.giphy.com/media/3o6gDWzmAzrpi5DQU8/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3o6gDWzmAzrpi5DQU8/200w.gif',
    category: 'money',
    tags: ['dinero', 'money', 'billetes', 'rico', 'pago', 'bizum'],
  },
  {
    id: 'gif-shut-up-money',
    title: 'Toma mi dinero',
    url: 'https://media.giphy.com/media/sDcfxFDozb3bO/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/sDcfxFDozb3bO/200w.gif',
    category: 'money',
    tags: ['dinero', 'take my money', 'pagar', 'cuenta', 'comprar'],
  },
  {
    id: 'gif-calculate',
    title: 'Haciendo cuentas',
    url: 'https://media.giphy.com/media/4JVTF9fRVGIO550xTe/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/4JVTF9fRVGIO550xTe/200w.gif',
    category: 'money',
    tags: ['cuentas', 'calcular', 'matematicas', 'division', 'gasto'],
  },

  // Risas y Humor
  {
    id: 'gif-laughing-1',
    title: 'Risas sin parar',
    url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif',
    category: 'funny',
    tags: ['risa', 'jaja', 'lol', 'gracioso', 'broma', 'humor'],
  },
  {
    id: 'gif-applause',
    title: 'Aplausos merecidos',
    url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/g9582DNuQppxC/200w.gif',
    category: 'funny',
    tags: ['aplausos', 'bravo', 'bien', 'clapping'],
  },
  {
    id: 'gif-thumbsup',
    title: 'Pulgar arriba perfecto',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif',
    category: 'funny',
    tags: ['ok', 'pulgar', 'de acuerdo', 'bien', 'top'],
  },

  // Viajes y Playa
  {
    id: 'gif-travel-flight',
    title: 'Despegando de viaje',
    url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/200w.gif',
    category: 'travel',
    tags: ['viaje', 'avion', 'vacaciones', 'volar', 'escapada'],
  },
  {
    id: 'gif-beach-relax',
    title: 'Relax en la playa',
    url: 'https://media.giphy.com/media/l41JGlwa1xYhkVczaw/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l41JGlwa1xYhkVczaw/200w.gif',
    category: 'travel',
    tags: ['playa', 'relax', 'sol', 'verano', 'mar'],
  },
  {
    id: 'gif-roadtrip',
    title: 'Carretera y manta',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif',
    category: 'travel',
    tags: ['coche', 'roadtrip', 'viaje', 'amigos'],
  },

  // Comida y Bebida
  {
    id: 'gif-pizza-delicious',
    title: 'Hora de la pizza',
    url: 'https://media.giphy.com/media/1108D2tVaUN3eo/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/1108D2tVaUN3eo/200w.gif',
    category: 'food',
    tags: ['pizza', 'comida', 'cenar', 'hambre', 'tapas'],
  },
  {
    id: 'gif-cheers-beer',
    title: 'Cañas y cervezas',
    url: 'https://media.giphy.com/media/Zw3oBUuIg231S/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/Zw3oBUuIg231S/200w.gif',
    category: 'food',
    tags: ['cerveza', 'cañas', 'bar', 'tapas', 'brindis'],
  },
  {
    id: 'gif-delicious-food',
    title: 'Banquete delicioso',
    url: 'https://media.giphy.com/media/XDchDUWSdX1bCTKiEc/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/XDchDUWSdX1bCTKiEc/200w.gif',
    category: 'food',
    tags: ['comida', 'rico', 'cenar', 'restaurante', 'almuerzo'],
  },

  // Sorpresa y Shock
  {
    id: 'gif-mind-blown',
    title: 'Mente explotada',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif',
    category: 'shock',
    tags: ['shock', 'sorpresa', 'wow', 'increible', 'flipando'],
  },
  {
    id: 'gif-what-shock',
    title: '¿Quééé?',
    url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/200w.gif',
    category: 'shock',
    tags: ['que', 'sorpresa', 'ojo', 'duda'],
  },

  // Agradecimiento y Abrazo
  {
    id: 'gif-thank-you',
    title: 'Muchas gracias',
    url: 'https://media.giphy.com/media/osjgQPWRx3cac/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/osjgQPWRx3cac/200w.gif',
    category: 'thanks',
    tags: ['gracias', 'thanks', 'abrazo', 'crack', 'top'],
  },
  {
    id: 'gif-high-five',
    title: 'Choca esos cinco',
    url: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/200w.gif',
    category: 'thanks',
    tags: ['choca', 'equipo', 'cinco', 'amigos', 'top'],
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: '✨' },
  { id: 'party', label: 'Fiesta', icon: '🎉' },
  { id: 'money', label: 'Dinero', icon: '💸' },
  { id: 'funny', label: 'Humor', icon: '😂' },
  { id: 'travel', label: 'Viajes', icon: '🏖️' },
  { id: 'food', label: 'Comida', icon: '🍕' },
  { id: 'shock', label: 'Sorpresa', icon: '🤯' },
  { id: 'thanks', label: 'Gracias', icon: '🙌' },
];

export const GifPickerModal: React.FC<GifPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectGif,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customGifUrl, setCustomGifUrl] = useState('');

  if (!isOpen) return null;

  const normalizedSearch = search.trim().toLowerCase();

  const filteredGifs = CURATED_GIFS.filter((gif) => {
    if (selectedCategory !== 'all' && gif.category !== selectedCategory) {
      return false;
    }
    if (normalizedSearch) {
      const matchTitle = gif.title.toLowerCase().includes(normalizedSearch);
      const matchTags = gif.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      return matchTitle || matchTags;
    }
    return true;
  });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customGifUrl.trim()) {
      onSelectGif(customGifUrl.trim());
      setCustomGifUrl('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('comments.gifPickerTitle') || 'GIFs Animados'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('comments.gifPickerSubtitle') || 'Elige un GIF animado o pega tu enlace'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('comments.searchGifsPlaceholder') || 'Buscar fiesta, dinero, risa, viaje...'}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Categories Horizontal Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* GIFs Grid */}
        <div className="flex-1 overflow-y-auto p-3 max-h-[50vh] custom-scrollbar">
          {filteredGifs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredGifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => {
                    onSelectGif(gif.url);
                    onClose();
                  }}
                  className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/50 transition-all focus:outline-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.previewUrl}
                    alt={gif.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-[10px] font-bold text-white truncate drop-shadow-xs">
                      {gif.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center space-y-2">
              <Film className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No se encontraron GIFs con ese término.
              </p>
            </div>
          )}
        </div>

        {/* Custom GIF URL Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
            <input
              type="url"
              value={customGifUrl}
              onChange={(e) => setCustomGifUrl(e.target.value)}
              placeholder="O pega URL de GIF (.gif)..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!customGifUrl.trim()}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl transition-all shadow-xs"
            >
              Usar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
