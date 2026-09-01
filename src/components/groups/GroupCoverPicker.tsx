'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import {
  Image as ImageIcon,
  Search,
  Upload,
  Trash2,
  Check,
  Camera,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { PhotoResult } from '@/app/api/photos/search/route';

export interface GroupCoverPickerProps {
  currentCoverUrl?: string | null;
  onSelectCover: (url: string | null) => void;
  groupName?: string;
}

const QUICK_TOPICS = [
  { label: '🏖️ Playa', query: 'playa' },
  { label: '🏔️ Montaña', query: 'montaña' },
  { label: '🍽️ Tapas & Cena', query: 'cena restaurante' },
  { label: '🏙️ Ciudad', query: 'ciudad viaje' },
  { label: '🎉 Fiesta', query: 'fiesta' },
  { label: '🏕️ Camping & Ruta', query: 'camping roadtrip' },
  { label: '⛷️ Nieve', query: 'nieve esqui' },
  { label: '🏡 Casa Rural', query: 'casa rural piscina' },
];

export const GroupCoverPicker: React.FC<GroupCoverPickerProps> = ({
  currentCoverUrl,
  onSelectCover,
  groupName = '',
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<PhotoResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [sourceAttribution, setSourceAttribution] = useState<'pexels' | 'curated'>('curated');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPhotos = async (searchTerm: string) => {
    const term = searchTerm.trim() || 'viaje amigos vacaciones';
    setIsLoading(true);
    try {
      const res = await fetch(`/api/photos/search?q=${encodeURIComponent(term)}&per_page=9`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.photos)) {
          setPhotos(data.photos);
          setSourceAttribution(data.source || 'pexels');
        }
      }
    } catch (e) {
      console.warn('Error fetching group cover photos:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger search when groupName changes (debounced)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (groupName.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        setQuery(groupName);
        fetchPhotos(groupName);
      }, 500);
    } else {
      fetchPhotos('viaje amigos');
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [groupName]);

  const handleManualSearch = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveTopic(null);
    fetchPhotos(query);
  };

  const handleTopicClick = (e: React.MouseEvent, topicQuery: string, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTopic(label);
    setQuery(topicQuery);
    fetchPhotos(topicQuery);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onSelectCover(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-3.5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
      {/* Current Preview or Upload Banner */}
      {currentCoverUrl ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/40 h-36 bg-slate-100 dark:bg-slate-800 group shadow-sm">
          <img
            src={currentCoverUrl}
            alt="Portada del grupo"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <label className="p-2 bg-white text-slate-800 rounded-xl cursor-pointer text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 shadow-md">
              <Camera className="w-4 h-4" />
              <span>{t('groups.changePhoto') || 'Subir otra'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectCover(null);
              }}
              className="p-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 shadow-md cursor-pointer"
              title={t('groups.removePhoto') || 'Quitar portada'}
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('groups.removePhoto') || 'Quitar foto'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Foto de portada del viaje
              </span>
              <span className="text-[11px] text-slate-400 block">
                Fotos sugeridas con Pexels API o sube la tuya
              </span>
            </div>
          </div>

          <label className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs">
            <Upload className="w-3.5 h-3.5" />
            <span>Subir imagen</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Dynamic Search from Pexels API */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Fotos sugeridas (Pexels)</span>
          </span>

          <span className="text-[10px] text-slate-400 font-mono">
            {sourceAttribution === 'pexels' ? 'Pexels API' : 'Catálogo HD'}
          </span>
        </div>

        {/* Search Bar (Isolated Div, not nested form) */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleManualSearch(e);
                }
              }}
              placeholder="Buscar tema de portada (ej. Roma, Ibiza, Fiesta...)"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleManualSearch(e);
            }}
            className="text-xs h-8 px-2.5 shrink-0 bg-white dark:bg-slate-800 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Buscar</span>}
          </Button>
        </div>

        {/* Quick Topic Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {QUICK_TOPICS.map((topic) => {
            const isSelected = activeTopic === topic.label;
            return (
              <button
                key={topic.label}
                type="button"
                onClick={(e) => handleTopicClick(e, topic.query, topic.label)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {topic.label}
              </button>
            );
          })}
        </div>

        {/* Photos Grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2 py-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-16 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            No se encontraron fotos para "{query}". Prueba con otra búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {photos.map((photo) => {
              const isSelected = currentCoverUrl === photo.url;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectCover(photo.url);
                  }}
                  className={`group relative rounded-xl overflow-hidden h-16 border-2 transition-all text-left shadow-2xs cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-102'
                      : 'border-transparent opacity-85 hover:opacity-100 hover:border-slate-300'
                  }`}
                  title={photo.alt}
                >
                  <img
                    src={photo.thumb || photo.url}
                    alt={photo.alt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-1">
                    {photo.photographer_url ? (
                      <a
                        href={photo.photographer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[9px] text-white/90 hover:text-white hover:underline font-medium truncate flex items-center gap-0.5 z-10 w-fit max-w-full"
                        title={`Ver perfil de ${photo.photographer} en Pexels`}
                      >
                        <span className="truncate">{photo.photographer}</span>
                        <ExternalLink className="w-2 h-2 shrink-0 opacity-80" />
                      </a>
                    ) : (
                      <span className="text-[9px] text-white/90 font-medium truncate">
                        {photo.photographer}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
