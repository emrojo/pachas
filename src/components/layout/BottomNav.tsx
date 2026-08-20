'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, User, PlusCircle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottomNavProps {
  onAddClick?: () => void;
  groupId?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onAddClick, groupId }) => {
  const pathname = usePathname();

  const isHome = pathname === '/dashboard' || pathname === '/';
  const isProfile = pathname === '/profile';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 px-6 py-2 pb-safe">
      <div className="flex items-center justify-around">
        <Link
          href="/dashboard"
          className={cn(
            'flex flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors',
            isHome
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          )}
        >
          <Layers className="w-5 h-5" />
          <span>Grupos</span>
        </Link>

        {onAddClick && (
          <button
            onClick={onAddClick}
            className="flex flex-col items-center -mt-5 group focus:outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-600 group-hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform active:scale-95">
              <PlusCircle className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
              Gasto
            </span>
          </button>
        )}

        <Link
          href="/profile"
          className={cn(
            'flex flex-col items-center gap-1 py-1 text-[11px] font-medium transition-colors',
            isProfile
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          )}
        >
          <User className="w-5 h-5" />
          <span>Perfil</span>
        </Link>
      </div>
    </nav>
  );
};
