'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import { Bell } from 'lucide-react';
import { subscribeDeviceToPush } from '@/lib/notifications/pushNotificationService';
import { GroupCoverPicker } from '@/components/groups/GroupCoverPicker';
import { sanitizeText } from '@/lib/security/sanitize';

export interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createGroup } = usePachas();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [currency, setCurrency] = useState('EUR');
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('groups.createModalSubtitle'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      if (enableNotifications) {
        try {
          await subscribeDeviceToPush();
        } catch (e) {
          console.warn('Push subscription during group creation:', e);
        }
      }

      const newGroup = await createGroup(
        sanitizeText(name, 80),
        sanitizeText(description, 300),
        '🏖️',
        currency,
        coverImageUrl,
        enableNotifications
      );
      setName('');
      setDescription('');
      setCoverImageUrl(null);
      onClose();
      if (onSuccess) onSuccess(newGroup.id);
    } catch (err: any) {
      setError(err.message || 'Error al crear el grupo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('groups.createGroup')}
      description={t('groups.createModalSubtitle')}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cover Photo Picker */}
        <div>
          <GroupCoverPicker
            currentCoverUrl={coverImageUrl}
            onSelectCover={(url) => setCoverImageUrl(url)}
            groupName={name}
          />
        </div>

        {/* Group Name */}
        <Input
          label={`${t('groups.groupName')} *`}
          placeholder={t('groups.groupNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          required
        />

        {/* Description */}
        <Input
          label={t('groups.groupDescription')}
          placeholder={t('groups.groupDescriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Base Currency */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {t('groups.baseCurrency')}
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol}) — {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notification Settings for this Group */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableNotifications}
              onChange={(e) => setEnableNotifications(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{t('notifications.enableOnCreate') || 'Activar notificaciones para este grupo'}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {t('notifications.enableOnCreateHint') || 'Recibe avisos al instante cuando tus amigos añadan o modifiquen gastos, comenten o salden deudas.'}
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="brand"
            isLoading={isLoading}
            className="flex-1 text-xs font-bold"
          >
            {t('groups.createGroupBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

