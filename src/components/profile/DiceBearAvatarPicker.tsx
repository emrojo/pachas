'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import {
  Sparkles,
  Dices,
  Upload,
  Palette,
  Layers,
  Check,
  X,
  Smile,
  Bot,
  User,
  Compass,
  Gamepad2,
  Brush,
} from 'lucide-react';

export interface DiceBearAvatarPickerProps {
  currentAvatarUrl?: string | null;
  onSelectAvatar: (url: string | null) => void;
  userName?: string;
}

export interface DiceBearStyleOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export const DICEBEAR_STYLES: DiceBearStyleOption[] = [
  { id: 'lorelei', name: 'Ilustración', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'bottts', name: 'Robots', icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'avataaars', name: 'Personajes', icon: <Smile className="w-3.5 h-3.5" /> },
  { id: 'adventurer', name: 'Aventura', icon: <Compass className="w-3.5 h-3.5" /> },
  { id: 'fun-emoji', name: 'Emojis', icon: <Smile className="w-3.5 h-3.5" /> },
  { id: 'notionists', name: 'Notionist', icon: <Brush className="w-3.5 h-3.5" /> },
  { id: 'pixel-art', name: 'Pixel Art', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { id: 'micah', name: 'Artístico', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

export const BACKGROUND_COLORS = [
  { id: 'transparent', label: 'Transparente', hex: '' },
  { id: 'b6e3f4', label: 'Cielo', hex: 'b6e3f4' },
  { id: 'c0aede', label: 'Lavanda', hex: 'c0aede' },
  { id: 'd1d4f9', label: 'Índigo', hex: 'd1d4f9' },
  { id: 'ffd5dc', label: 'Rosa', hex: 'ffd5dc' },
  { id: 'ffdfbf', label: 'Melocotón', hex: 'ffdfbf' },
  { id: '10b981', label: 'Esmeralda', hex: '10b981' },
  { id: '334155', label: 'Pizarra', hex: '334155' },
];

export const CURATED_DICEBEAR_PRESETS = [
  'https://api.dicebear.com/9.x/lorelei/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/9.x/bottts/svg?seed=Gizmo&backgroundColor=c0aede',
  'https://api.dicebear.com/9.x/avataaars/svg?seed=Aneka&backgroundColor=ffdfbf',
  'https://api.dicebear.com/9.x/adventurer/svg?seed=Midnight&backgroundColor=d1d4f9',
  'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Smiley&backgroundColor=ffd5dc',
  'https://api.dicebear.com/9.x/notionists/svg?seed=Oliver&backgroundColor=b6e3f4',
  'https://api.dicebear.com/9.x/pixel-art/svg?seed=Retro&backgroundColor=10b981',
  'https://api.dicebear.com/9.x/micah/svg?seed=Luna&backgroundColor=c0aede',
];

export function buildDiceBearUrl(style: string, seed: string, bgHex?: string): string {
  const cleanSeed = encodeURIComponent(seed.trim() || 'Pachas');
  const bgParam = bgHex ? `&backgroundColor=${bgHex}` : '';
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${cleanSeed}${bgParam}`;
}

export const DiceBearAvatarPicker: React.FC<DiceBearAvatarPickerProps> = ({
  currentAvatarUrl,
  onSelectAvatar,
  userName = '',
}) => {
  const { t } = useTranslation();
  const [selectedStyle, setSelectedStyle] = useState<string>('lorelei');
  const [seed, setSeed] = useState<string>(userName || 'Amigo');
  const [bgColor, setBgColor] = useState<string>('b6e3f4');
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  // Sync initial seed from userName if changed
  useEffect(() => {
    if (userName && (!seed || seed === 'Amigo')) {
      setSeed(userName);
    }
  }, [userName]);

  const handleRandomizeSeed = () => {
    const randomWords = [
      'Leo', 'Mia', 'Alex', 'Luna', 'Paco', 'Sofia', 'Nico', 'Clara',
      'Bruno', 'Elena', 'Lucas', 'Vega', 'Hugo', 'Maya', 'Mateo', 'Iris',
      'Apolo', 'Zeus', 'Cometa', 'Brisa', 'Sol', 'Chispa', 'Pixel', 'Samba'
    ];
    const pick = randomWords[Math.floor(Math.random() * randomWords.length)] + '-' + Math.floor(Math.random() * 900 + 100);
    setSeed(pick);
    const newUrl = buildDiceBearUrl(selectedStyle, pick, bgColor);
    onSelectAvatar(newUrl);
  };

  const handleStyleChange = (styleId: string) => {
    setSelectedStyle(styleId);
    const newUrl = buildDiceBearUrl(styleId, seed, bgColor);
    onSelectAvatar(newUrl);
  };

  const handleBgColorChange = (hex: string) => {
    setBgColor(hex);
    const newUrl = buildDiceBearUrl(selectedStyle, seed, hex);
    onSelectAvatar(newUrl);
  };

  const handleCustomSeedChange = (val: string) => {
    setSeed(val);
    const newUrl = buildDiceBearUrl(selectedStyle, val, bgColor);
    onSelectAvatar(newUrl);
  };

  const handleUploadCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onSelectAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generatedCustomUrl = buildDiceBearUrl(selectedStyle, seed, bgColor);

  return (
    <div className="space-y-3.5 p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-800">
      {/* Header and Modes */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>Elegir Avatar (DiceBear)</span>
        </label>

        <div className="flex items-center gap-1">
          <div className="flex p-0.5 bg-slate-200 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                activeTab === 'presets'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Colección Rápida
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('custom');
                onSelectAvatar(generatedCustomUrl);
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                activeTab === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Personalizar
            </button>
          </div>

          <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer ml-1">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('groups.uploadPhoto')}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadCustomImage}
            />
          </label>
        </div>
      </div>

      {/* Tab 1: Fast Presets */}
      {activeTab === 'presets' && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {CURATED_DICEBEAR_PRESETS.map((url, idx) => {
              const isSelected = currentAvatarUrl === url;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectAvatar(url)}
                  className={`relative w-12 h-12 rounded-2xl p-1 border-2 transition-all shrink-0 bg-white dark:bg-slate-800 shadow-2xs overflow-hidden ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/40 scale-105'
                      : 'border-slate-200 dark:border-slate-700/80 opacity-80 hover:opacity-100 hover:border-slate-300'
                  }`}
                  title={`Avatar DiceBear ${idx + 1}`}
                >
                  <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-contain" />
                  {isSelected && (
                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Interactive DiceBear Customizer */}
      {activeTab === 'custom' && (
        <div className="space-y-3 pt-1 animate-in fade-in duration-150">
          {/* Style Selector Chips */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              1. Estilo de personaje
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {DICEBEAR_STYLES.map((st) => {
                const isSelected = selectedStyle === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleStyleChange(st.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {st.icon}
                    <span>{st.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seed Input & Randomize */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              2. Semilla / Rasgos del avatar
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={seed}
                onChange={(e) => handleCustomSeedChange(e.target.value)}
                placeholder="Escribe tu nombre o apodo..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRandomizeSeed}
                className="text-xs font-bold gap-1.5 h-8 shrink-0 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                title="Generar rasgos aleatorios"
              >
                <Dices className="w-3.5 h-3.5 text-emerald-500" />
                <span>Aleatorio</span>
              </Button>
            </div>
          </div>

          {/* Background Palette */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              3. Color de fondo
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {BACKGROUND_COLORS.map((bg) => {
                const isSelected = bgColor === bg.hex;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => handleBgColorChange(bg.hex)}
                    style={{ backgroundColor: bg.hex ? `#${bg.hex}` : 'transparent' }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform shrink-0 flex items-center justify-center shadow-2xs ${
                      isSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-500/40 scale-110'
                        : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                    } ${!bg.hex ? 'border-dashed' : ''}`}
                    title={bg.label}
                  >
                    {!bg.hex && <X className="w-3 h-3 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
