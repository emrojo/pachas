'use client';

import React, { useState, useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  getSyncQueue,
  removeSyncAction,
  retrySingleSyncAction,
  clearSyncQueue,
  SyncAction,
} from '@/lib/sync/syncManager';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import {
  CloudOff,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Users,
  Handshake,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';

export interface PendingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PendingSyncModal: React.FC<PendingSyncModalProps> = ({ isOpen, onClose }) => {
  const { syncPendingQueue, isOnline } = usePachas();
  const { t } = useTranslation();
  const [queue, setQueue] = useState<SyncAction[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const refreshList = () => {
    setQueue(getSyncQueue());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setStatusMsg(null);
    }
  }, [isOpen]);

  const handleRetrySingle = async (action: SyncAction) => {
    setRetryingId(action.id);
    setStatusMsg(null);
    try {
      const supabase = createClient();
      const success = await retrySingleSyncAction(action.id, supabase);
      if (success) {
        setStatusMsg(`✅ "${action.title || action.type}" sincronizado con éxito.`);
      } else {
        setStatusMsg(`⚠️ No se pudo sincronizar "${action.title || action.type}". Revisa el motivo actualizado.`);
      }
      refreshList();
    } catch (e: any) {
      setStatusMsg(`❌ Error al reintentar: ${e.message || 'Error desconocido'}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDiscardSingle = (actionId: string, title?: string) => {
    if (!confirm(`¿Deseas descartar este registro local pendiente ("${title || 'Registro'}")? Se perderá si no se sincronizó.`)) {
      return;
    }
    removeSyncAction(actionId);
    refreshList();
  };

  const handleRetryAll = async () => {
    setIsRetryingAll(true);
    setStatusMsg(null);
    try {
      await syncPendingQueue();
      refreshList();
      setStatusMsg('🔄 Proceso de sincronización completado.');
    } catch (e: any) {
      setStatusMsg(`❌ Error al sincronizar: ${e.message || 'Error desconocido'}`);
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleDiscardAll = () => {
    if (!confirm('¿Estás seguro de descartar TODOS los registros pendientes locales? Esta acción no se puede deshacer.')) {
      return;
    }
    clearSyncQueue();
    refreshList();
    onClose();
  };

  const getActionBadge = (type: SyncAction['type']) => {
    switch (type) {
      case 'CREATE_EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
            <DollarSign className="w-3 h-3" /> Nuevo Gasto
          </span>
        );
      case 'UPDATE_EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
            <RefreshCw className="w-3 h-3" /> Editar Gasto
          </span>
        );
      case 'DELETE_EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
            <Trash2 className="w-3 h-3" /> Eliminar Gasto
          </span>
        );
      case 'CREATE_SETTLEMENT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-800">
            <Handshake className="w-3 h-3" /> Liquidación
          </span>
        );
      case 'CREATE_GROUP':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
            <Layers className="w-3 h-3" /> Crear Grupo
          </span>
        );
      case 'JOIN_GROUP':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
            <Users className="w-3 h-3" /> Unirse a Grupo
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            <HelpCircle className="w-3 h-3" /> {type}
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registros pendientes de sincronizar"
      description="Consulta qué cambios no se han enviado todavía a la base de datos central y cuál es el motivo o error exacto."
      maxWidth="lg"
    >
      <div className="space-y-4 py-1">
        {/* Status Alert if any action happened */}
        {statusMsg && (
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 animate-in fade-in">
            {statusMsg}
          </div>
        )}

        {/* Global Network Notice */}
        {!isOnline && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Actualmente estás <strong>sin conexión</strong> a internet. Los cambios están a salvo en este dispositivo y se intentarán enviar en cuanto recuperes la red.
            </span>
          </div>
        )}

        {/* Queue Items List */}
        {queue.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              ¡Todo está perfectamente sincronizado!
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No tienes ningún registro en cola pendiente de envío.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {queue.map((item, index) => {
              const isRetrying = retryingId === item.id;
              const hasFailed = Boolean(item.lastError || (item.retryCount && item.retryCount > 0));

              return (
                <div
                  key={item.id || index}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getActionBadge(item.type)}
                        {item.groupName && (
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            🌴 {item.groupName}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {formatDate(new Date(item.timestamp).toISOString(), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.title || item.type}
                      </h4>
                    </div>

                    {/* Actions per item */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetrySingle(item)}
                        disabled={isRetrying || isRetryingAll}
                        className="text-xs font-bold gap-1 h-8 px-2.5"
                        title="Reintentar enviar este registro al servidor"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                        <span>{isRetrying ? 'Enviando...' : 'Reintentar'}</span>
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleDiscardSingle(item.id, item.title)}
                        disabled={isRetrying || isRetryingAll}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                        title="Descartar este registro local"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Failure Cause / Reason Card */}
                  <div className={`p-2.5 rounded-xl border text-xs leading-relaxed space-y-1 ${
                    hasFailed
                      ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                      : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
                  }`}>
                    <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Causa / Motivo del estado:</span>
                      </span>
                      {item.retryCount !== undefined && (
                        <span className="text-[10px] lowercase font-normal px-1.5 py-0.2 rounded bg-white/60 dark:bg-black/40">
                          {item.retryCount} reintento(s)
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-xs break-words">
                      {item.lastError || (!isOnline ? 'Dispositivo desconectado de la red' : 'Pendiente de procesamiento')}
                    </p>
                    {item.lastAttemptTimestamp && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block pt-0.5">
                        Último intento: {formatDate(new Date(item.lastAttemptTimestamp).toISOString(), 'HH:mm:ss')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {queue.length > 0 ? (
            <button
              type="button"
              onClick={handleDiscardAll}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Descartar todos los registros</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('common.close') || 'Cerrar'}
            </Button>

            {queue.length > 0 && (
              <Button
                variant="brand"
                size="sm"
                onClick={handleRetryAll}
                disabled={isRetryingAll}
                isLoading={isRetryingAll}
                className="text-xs font-bold gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetryingAll ? 'animate-spin' : ''}`} />
                <span>Reintentar todos ({queue.length})</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
