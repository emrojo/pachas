'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

import { PendingSyncModal } from '@/components/sync/PendingSyncModal';
import { Eye } from 'lucide-react';

export function OfflineBanner() {
  const { isOnline, pendingSyncCount, syncPendingQueue, clearPendingSyncQueue } = usePachas();
  const { t } = useTranslation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await syncPendingQueue();
      setSyncSuccessMsg(true);
      setTimeout(() => setSyncSuccessMsg(false), 2500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = () => {
    clearPendingSyncQueue();
    setSyncSuccessMsg(true);
    setTimeout(() => setSyncSuccessMsg(false), 2000);
  };

  // When online, everything synced and no message -> strictly render NOTHING
  if (isOnline && pendingSyncCount === 0 && !syncSuccessMsg) {
    return (
      <PendingSyncModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    );
  }

  return (
    <>
      <div className={`w-full text-xs px-4 py-2.5 transition-all shadow-xs border-b ${
        !isOnline
          ? 'bg-amber-900/90 text-amber-100 border-amber-800/80'
          : syncSuccessMsg
          ? 'bg-emerald-900/90 text-emerald-100 border-emerald-800/80'
          : 'bg-indigo-950/95 text-indigo-100 border-indigo-900/80'
      }`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          {!isOnline ? (
            <div className="flex items-center gap-2 font-medium">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-300 animate-pulse" />
              <span>{t('sync.offlineNotice')}</span>
            </div>
          ) : syncSuccessMsg ? (
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('sync.syncedSuccess')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-indigo-300" />
              <span>
                {pendingSyncCount === 1
                  ? t('sync.pendingNotice', { count: pendingSyncCount })
                  : t('sync.pendingNoticePlural', { count: pendingSyncCount })}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {pendingSyncCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsDetailsOpen(true)}
                className="text-xs h-7 py-0 px-2.5 bg-black/20 hover:bg-black/30 text-white border-white/20 gap-1 cursor-pointer shadow-xs"
                title="Ver por qué no se sincronizaron y lista de registros"
              >
                <Eye className="w-3 h-3" />
                <span>Ver causas ({pendingSyncCount})</span>
              </Button>
            )}

            {isOnline && pendingSyncCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="text-[11px] text-indigo-300 hover:text-white underline hover:no-underline px-2 py-1 transition-colors cursor-pointer"
                  title={t('sync.discardTooltip')}
                >
                  {t('sync.discard')}
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="text-xs h-7 py-0 px-3 bg-indigo-900/80 hover:bg-indigo-800 text-white border-indigo-700 gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? t('sync.syncing') : t('sync.syncNow')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <PendingSyncModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </>
  );
}



