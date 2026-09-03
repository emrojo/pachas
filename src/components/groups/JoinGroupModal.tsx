'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { KeyRound, Bell } from 'lucide-react';
import { subscribeDeviceToPush } from '@/lib/notifications/pushNotificationService';

export interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

export const JoinGroupModal: React.FC<JoinGroupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { joinGroup } = usePachas();
  const { t } = useTranslation();
  const router = useRouter();

  const [joinCode, setJoinCode] = useState('');
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim();
    if (!cleanCode) return;

    try {
      setIsLoading(true);
      setError('');

      if (enableNotifications) {
        try {
          await subscribeDeviceToPush();
        } catch (e) {
          console.warn('Push subscription during join modal:', e);
        }
      }

      const joinedGroup = await joinGroup(cleanCode, enableNotifications);
      if (!joinedGroup) {
        setError(t('dashboard.joinGroupError') || 'No se pudo unir al grupo. Verifica el código de invitación.');
      } else {
        setJoinCode('');
        onClose();
        if (onSuccess) {
          onSuccess(joinedGroup.id);
        } else {
          router.push(`/groups/${joinedGroup.id}`);
        }
      }
    } catch (err: any) {
      setError(err?.message || t('dashboard.joinGroupError') || 'No se pudo unir al grupo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setError('');
    setJoinCode('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={t('dashboard.joinWithCode') || 'Unirse con código'}
      description={t('dashboard.joinByCodePlaceholder') || 'Introduce el código de invitación para unirte al grupo.'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            {t('dashboard.joinWithCode') || 'Código de invitación'}
          </label>
          <Input
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              if (error) setError('');
            }}
            placeholder="Ej: ABC123"
            leftIcon={<KeyRound className="w-4 h-4 text-emerald-600" />}
            maxLength={10}
            autoFocus
            className="tracking-widest font-mono uppercase text-base"
          />
        </div>

        <label className="flex items-center gap-2 px-1 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={enableNotifications}
            onChange={(e) => setEnableNotifications(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 cursor-pointer"
          />
          <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{t('notifications.enableOnJoin') || 'Activar notificaciones al unirme'}</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={handleModalClose}
            disabled={isLoading}
          >
            {t('common.cancel') || 'Cancelar'}
          </Button>
          <Button
            type="submit"
            variant="brand"
            isLoading={isLoading}
            disabled={!joinCode.trim() || isLoading}
            className="font-bold shadow-xs"
          >
            {t('dashboard.joinGroupBtn') || 'Unirse'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
