'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function OfflineBanner() {
  const { isOnline, pendingSyncCount, syncPendingQueue } = usePachas();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState(false);

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

  // When online, everything synced and no message -> strictly render NOTHING
  if (isOnline && pendingSyncCount === 0 && !syncSuccessMsg) {
    return null;
  }

  return (
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
            <span>
              <strong>Sin conexión a internet:</strong> Tus cambios se han guardado en este dispositivo y se sincronizarán automáticamente en cuanto vuelva la red.
            </span>
          </div>
        ) : syncSuccessMsg ? (
          <div className="flex items-center gap-2 font-bold text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>¡Todos tus registros se han sincronizado con la base de datos!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-indigo-300" />
            <span>
              Tienes <strong>{pendingSyncCount}</strong> {pendingSyncCount === 1 ? 'registro pendiente' : 'registros pendientes'} de sincronizar con la base de datos.
            </span>
          </div>
        )}

        {isOnline && pendingSyncCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="text-xs h-7 py-0 px-3 bg-indigo-900/80 hover:bg-indigo-800 text-white border-indigo-700 gap-1.5 ml-auto cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </Button>
        )}
      </div>
    </div>
  );
}

