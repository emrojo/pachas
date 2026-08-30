'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smile, Search, X } from 'lucide-react';

export interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  anchorEl?: HTMLElement | null;
  className?: string;
  position?: 'top' | 'bottom' | 'auto';
}

const EMOJI_CATEGORIES = [
  {
    name: 'Reacciones populares',
    emojis: ['❤️', '👍', '😂', '🎉', '🔥', '💸', '👏', '🙌', '😍', '🏖️', '🍻', '🍕', '🚀', '💡', '🥑', '✨'],
  },
  {
    name: 'Caras y Emociones',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '💩', '🤡', '👻', '🙈', '🙉', '🙊'],
  },
  {
    name: 'Dinero, Cuentas y Fiesta',
    emojis: ['💸', '💰', '💳', '💵', '💶', '💷', '🪙', '🧾', '📊', '📈', '📉', '🛒', '🛍️', '🎁', '🎉', '🎊', '🎈', '🍾', '🥂', '🍻', '🍺', '🍷', '🍸', '🍹', '🧉', '☕', '🍵', '🧃', '🥤', '🍕', '🍔', '🍟', '🌮', '🌯', '🥪', '🥘', '🍝', '🍣', '🍦', '🍰', '🎂'],
  },
  {
    name: 'Viajes, Playa y Transporte',
    emojis: ['✈️', '🏖️', '🏝️', '🌴', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲', '🛴', '🚂', '🚆', '🚇', '🚢', '🛳️', '🛥️', '🚤', '⛵', '🗺️', '🧭', '🏨', '🏰', '⛺', '🌅', '🌄', '🏔️', '🌋', '🗻', '🏕️', '🛤️'],
  },
];

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  anchorEl,
  className = '',
  position = 'auto',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update position based on anchor element
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const popoverWidth = 300;
      const popoverHeight = 350;

      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        let top = 0;
        let left = rect.left + rect.width / 2 - popoverWidth / 2;

        // Auto determine top vs bottom
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (position === 'top' || (position === 'auto' && spaceBelow < popoverHeight && spaceAbove > popoverHeight)) {
          top = Math.max(10, rect.top - popoverHeight - 8);
        } else {
          top = Math.min(window.innerHeight - popoverHeight - 10, rect.bottom + 8);
        }

        // Clamp horizontal
        left = Math.max(10, Math.min(left, window.innerWidth - popoverWidth - 10));

        setCoords({ top, left });
      } else {
        // Center fallback
        setCoords({
          top: Math.max(20, window.innerHeight / 2 - popoverHeight / 2),
          left: Math.max(20, window.innerWidth / 2 - popoverWidth / 2),
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, anchorEl, position]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        (!anchorEl || !anchorEl.contains(e.target as Node))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen || !mounted) return null;

  const filteredCategories = EMOJI_CATEGORIES.map((cat) => ({
    ...cat,
    emojis: search
      ? cat.emojis.filter((e) => e.includes(search))
      : cat.emojis,
  })).filter((cat) => cat.emojis.length > 0);

  const popoverContent = (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 99999,
      }}
      className={`w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-3.5 animate-in fade-in zoom-in-95 duration-150 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Smile className="w-4 h-4 text-emerald-600" />
          <span>Elige un emoticono</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick top bar */}
      <div className="flex items-center justify-between gap-1 py-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800">
        {['❤️', '👍', '😂', '🎉', '🔥', '💸', '👏', '🏖️'].map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
              onClose();
            }}
            className="p-1.5 text-base hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="pt-2 pb-1.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Emoji Scroll Grid */}
      <div className="max-h-48 overflow-y-auto space-y-3 pr-1 -mr-1 custom-scrollbar">
        {filteredCategories.map((cat) => (
          <div key={cat.name} className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block px-1">
              {cat.name}
            </span>
            <div className="grid grid-cols-8 gap-1">
              {cat.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelectEmoji(emoji);
                    onClose();
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(popoverContent, document.body) : null;
};
