'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { ShieldAlert, LogOut, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ImpersonationBanner() {
  const { isImpersonating, impersonatorAdmin, currentUser, stopImpersonating } = usePachas();
  const { t } = useTranslation();
  const [isExiting, setIsExiting] = useState(false);

  if (!isImpersonating || !currentUser) {
    return null;
  }

  const handleStop = async () => {
    try {
      setIsExiting(true);
      await stopImpersonating();
    } finally {
      setIsExiting(false);
    }
  };

  const targetName = currentUser.full_name || currentUser.email;
  const adminIdentifier = impersonatorAdmin?.full_name || impersonatorAdmin?.email || 'Admin';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg border-b border-amber-500/40 px-3 sm:px-4 py-2.5 transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/20 text-white shrink-0 text-lg">
            🎭
          </div>
          <div className="text-xs sm:text-sm leading-tight truncate">
            <div className="font-bold flex items-center gap-1.5 flex-wrap">
              <span>{t('admin.impersonatingBannerTitle') || 'Modo Impersonación Activo'}</span>
              <span className="hidden sm:inline opacity-75">•</span>
              <span className="bg-black/25 px-2 py-0.5 rounded text-xs font-mono font-medium truncate max-w-[200px] sm:max-w-none">
                {targetName} ({currentUser.email})
              </span>
            </div>
            <div className="text-amber-100 text-[11px] sm:text-xs opacity-90 truncate mt-0.5">
              {t('admin.impersonatingBannerSubtitle')
                ? t('admin.impersonatingBannerSubtitle')
                    .replace('{{name}}', targetName)
                    .replace('{{email}}', currentUser.email)
                    .replace('{{adminEmail}}', adminIdentifier)
                : `Sesión de ${adminIdentifier}. Navegando con los permisos y datos de este usuario.`}
            </div>
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center justify-end">
          <Button
            size="sm"
            onClick={handleStop}
            disabled={isExiting}
            className="w-full sm:w-auto bg-black/30 hover:bg-black/50 text-white font-medium border border-white/20 shadow-sm text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 transition-all"
          >
            {isExiting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('admin.exitingImpersonation') || 'Saliendo...'}</span>
              </>
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('admin.stopImpersonating') || 'Salir de la impersonación'}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
