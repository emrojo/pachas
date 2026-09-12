'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import { Bell, Users, Sparkles, Plus, Trash2, Shuffle } from 'lucide-react';
import { subscribeDeviceToPush } from '@/lib/notifications/pushNotificationService';
import { GroupCoverPicker } from '@/components/groups/GroupCoverPicker';
import { sanitizeText } from '@/lib/security/sanitize';
import { generateProvisionalNames, generateFunProvisionalNames } from '@/lib/groups/unclaimedMembers';

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
  const [initialMembers, setInitialMembers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddMember = () => {
    setInitialMembers((prev) => [...prev, `Amigo ${prev.length + 1}`]);
  };

  const handleRemoveMember = (index: number) => {
    setInitialMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMemberNameChange = (index: number, newName: string) => {
    setInitialMembers((prev) => {
      const copy = [...prev];
      copy[index] = newName;
      return copy;
    });
  };

  const handleGenerateDefaultNames = (count: number) => {
    setInitialMembers(generateProvisionalNames(count));
  };

  const handleGenerateFunNames = (count: number) => {
    setInitialMembers(generateFunProvisionalNames(count));
  };

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

      const cleanMembers = initialMembers.map((m) => sanitizeText(m, 50)).filter(Boolean);

      const newGroup = await createGroup(
        sanitizeText(name, 80),
        sanitizeText(description, 300),
        '🏖️',
        currency,
        coverImageUrl,
        enableNotifications,
        cleanMembers
      );
      setName('');
      setDescription('');
      setCoverImageUrl(null);
      setInitialMembers([]);
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

        {/* Estimated Initial Provisional Members */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {t('groups.estimatedMembers') || 'Participantes iniciales estimados'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleGenerateDefaultNames(initialMembers.length > 0 ? initialMembers.length : 3)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                title="Generar nombres como Amigo 1, Amigo 2..."
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateFunNames(initialMembers.length > 0 ? initialMembers.length : 3)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                title="Generar nombres temáticos divertidos de viaje"
              >
                <Shuffle className="w-3 h-3" />
                <span>Viajeros</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('groups.estimatedMembersHint') || 'Define amigos provisionales para repartir gastos desde el primer minuto. Podrán reclamar su puesto más tarde mediante un enlace único.'}
          </p>

          {/* Quick preset buttons if empty */}
          {initialMembers.length === 0 && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium">Estimar grupo:</span>
              {[2, 3, 4, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => handleGenerateDefaultNames(cnt)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                >
                  +{cnt} amigos
                </button>
              ))}
            </div>
          )}

          {/* List of members */}
          {initialMembers.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {initialMembers.map((memberName, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => handleMemberNameChange(idx, e.target.value)}
                    placeholder={`Amigo ${idx + 1}`}
                    maxLength={50}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Eliminar participante"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 flex justify-between items-center">
            <button
              type="button"
              onClick={handleAddMember}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('groups.addFriendSlot') || 'Añadir otro amigo'}</span>
            </button>
            {initialMembers.length > 0 && (
              <button
                type="button"
                onClick={() => setInitialMembers([])}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Limpiar lista
              </button>
            )}
          </div>
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

