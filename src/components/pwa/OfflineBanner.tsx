'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react';
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
      setTimeout(() => setSyncSuccessMsg(false), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // If online and no pending items and no success message, render nothing
  if (isOnline && pendingSyncCount === 0 && !syncSuccessMsg) {
    return null;
  }

  return (
    <div className="w-full bg-slate-900 text-white border-b border-slate-800 text-xs px-4 py-2.5 transition-all">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        {!isOnline ? (
          <div className="flex items-center gap-2 text-amber-400 font-medium">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              <strong>Modo Sin Conexión:</strong> Puedes añadir gastos normalmente. Se guardarán en tu dispositivo y se sincronizarán al recuperar la red.
            </span>
          </div>
        ) : syncSuccessMsg ? (
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>¡Todos tus registros pendientes se han sincronizado con la base de datos!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sky-400 font-medium">
            <CloudUpload className="w-4 h-4 shrink-0" />
            <span>
              Tienes <strong>{pendingSyncCount}</strong> {pendingSyncCount === 1 ? 'cambio pendiente' : 'cambios pendientes'} de sincronizar con el servidor.
            </span>
          </div>
        )}

        {isOnline && pendingSyncCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="text-xs h-7 py-0 px-2.5 bg-slate-800 hover:bg-slate-700 text-white border-slate-700 gap-1.5 ml-auto"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </Button>
        )}
      </div>
    </div>
  );
}
