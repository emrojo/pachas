'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas, safeSetLocalStorage } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { useDonationUrl } from '@/lib/useDonationUrl';
import { triggerHaptic } from '@/lib/native/haptics';
import { Avatar } from '@/components/ui/Avatar';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Group } from '@/types/database';
import {
  ChevronDown,
  Lock,
  Globe,
  Coffee,
  User,
  ArrowUpRight,
  LogOut,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export interface MobileHeaderProps {
  activeGroup?: Group | null;
  onSelectGroup?: (groupId: string) => void;
  onSwitchToWeb?: () => void;
  showBackButton?: boolean;
  backHref?: string;
  onBackClick?: () => void;
  title?: string;
  onCreateGroupClick?: () => void;
  onJoinGroupClick?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeGroup,
  onSelectGroup,
  onSwitchToWeb,
  showBackButton = false,
  backHref = '/dashboard',
  onBackClick,
  title,
  onCreateGroupClick,
  onJoinGroupClick,
}) => {
  const router = useRouter();
  const { groups, currentUser, logout, isDemoMode, availableUsers, setCurrentUser } = usePachas();
  const { t } = useTranslation();
  const donationUrl = useDonationUrl();

  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activeGroups = groups.filter((g) => !g.is_archived);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGroupSelect = (id: string) => {
    triggerHaptic('light');
    setIsGroupSwitcherOpen(false);
    if (onSelectGroup) {
      onSelectGroup(id);
    } else {
      safeSetLocalStorage('pachas_mobile_active_group', id);
      router.push(`/groups/${id}`);
    }
  };

  const handleBack = () => {
    triggerHaptic('light');
    if (onBackClick) {
      onBackClick();
    } else {
      router.push(backHref);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 pt-3 pb-3">
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        {/* Left Section: Back Button OR Group Switcher */}
        {showBackButton ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleBack}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer shadow-2xs"
              aria-label={t('common.back') || 'Volver'}
              title={t('common.back') || 'Volver'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {title && (
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                {title}
              </h1>
            )}
          </div>
        ) : (
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsGroupSwitcherOpen(!isGroupSwitcherOpen);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all text-left max-w-full cursor-pointer"
              title={t('dashboard.switchGroup') || 'Cambiar de grupo'}
              aria-label={t('dashboard.switchGroup') || 'Cambiar de grupo'}
            >
              {activeGroup?.cover_image_url ? (
                <img
                  src={activeGroup.cover_image_url}
                  alt=""
                  className="w-8 h-8 rounded-xl object-cover shrink-0"
                />
              ) : (
                <span className="text-xl shrink-0">{activeGroup?.icon_emoji || '🏖️'}</span>
              )}
              <span className="text-base font-black text-slate-900 dark:text-white truncate">
                {activeGroup ? activeGroup.name : t('dashboard.noGroupsTitle') || 'Pachas'}
              </span>
              {activeGroup && (
                activeGroup.is_closed ? (
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                )
              )}
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
            </button>

            {/* Dropdown Groups Popover */}
            {isGroupSwitcherOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-2.5 py-1.5 text-sm font-black uppercase text-slate-400">
                  {t('dashboard.yourGroups') || 'Tus Grupos'}
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {activeGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleGroupSelect(g.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-base transition-colors cursor-pointer ${
                        g.id === activeGroup?.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                      }`}
                    >
                      <span className="text-xl">{g.icon_emoji || '🏖️'}</span>
                      <span className="truncate flex-1 font-bold">{g.name}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2 flex gap-2">
                  {onCreateGroupClick && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsGroupSwitcherOpen(false);
                        onCreateGroupClick();
                      }}
                      className="flex-1 py-2 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl cursor-pointer"
                    >
                      + {t('nav.newGroup') || 'Nuevo'}
                    </button>
                  )}
                  {onJoinGroupClick && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsGroupSwitcherOpen(false);
                        onJoinGroupClick();
                      }}
                      className="flex-1 py-2 text-center text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                    >
                      {t('nav.joinGroup') || 'Unirse'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Section: Donation / Language / Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {donationUrl && (
            <a
              href={donationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center transition-transform active:scale-95 shadow-2xs cursor-pointer"
              title={t('dashboard.supportProject') || 'Apoyar el proyecto'}
              aria-label={t('dashboard.supportProject') || 'Apoyar el proyecto'}
            >
              <Coffee className="w-5 h-5" />
            </a>
          )}

          <LanguageSelector variant="compact" />

          {currentUser && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className="rounded-full ring-2 ring-transparent hover:ring-emerald-500 transition-all cursor-pointer block p-0.5"
                aria-label={t('nav.profile') || 'Menú de usuario'}
              >
                <Avatar profile={currentUser} size="sm" className="w-9 h-9 text-xs shadow-2xs" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 text-base">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-1.5">
                    <div className="font-bold text-slate-900 dark:text-white truncate text-base">
                      {currentUser.full_name || 'Usuario'}
                    </div>
                    <div className="text-sm text-slate-400 truncate mt-0.5">{currentUser.email}</div>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-base"
                  >
                    <User className="w-4.5 h-4.5 text-slate-400" />
                    <span>{t('nav.profile') || 'Mi Perfil'}</span>
                  </Link>

                  {onSwitchToWeb ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSwitchToWeb();
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-base text-left cursor-pointer"
                    >
                      <ArrowUpRight className="w-4.5 h-4.5 text-slate-400" />
                      <span>{t('common.webView')}</span>
                    </button>
                  ) : (
                    <Link
                      href="/dashboard"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-base"
                    >
                      <ArrowUpRight className="w-4.5 h-4.5 text-slate-400" />
                      <span>{t('common.webView')}</span>
                    </Link>
                  )}

                  {isDemoMode && availableUsers.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                      <div className="px-2 py-1 text-sm font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Simular:
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {availableUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setCurrentUser(u);
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full text-left p-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 truncate"
                          >
                            {u.full_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 font-medium text-base cursor-pointer"
                    >
                      <LogOut className="w-4.5 h-4.5" />
                      <span>{t('nav.logout') || 'Cerrar sesión'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
