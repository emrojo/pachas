'use client';

import React, { useState, useEffect } from 'react';
import { Group } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import {
  Archive,
  ArchiveRestore,
  Shield,
  Bell,
  BellOff,
  Sparkles,
  Check,
  Users,
  Plus,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  getGroupNotificationPreference,
  setGroupNotificationPreference,
} from '@/lib/notifications/pushNotificationService';
import { GroupCoverPicker } from '@/components/groups/GroupCoverPicker';
import { sanitizeText } from '@/lib/security/sanitize';

export interface EditGroupModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated: Group) => void;
}

export const EditGroupModal: React.FC<EditGroupModalProps> = ({
  group,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateGroup, archiveGroup, restoreGroup, isGroupAdmin, getGroupMembers, renameUnclaimedMember, addUnclaimedMember } = usePachas();
  const { t } = useTranslation();

  const isAdmin = isGroupAdmin(group.id);
  const groupMembers = getGroupMembers(group.id);
  const unclaimedMembers = groupMembers.filter((m) => m.is_unclaimed);

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(group.cover_image_url || null);
  const [currency, setCurrency] = useState(group.base_currency || 'EUR');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [provisionalNames, setProvisionalNames] = useState<Record<string, string>>({});
  const [newProvisionalName, setNewProvisionalName] = useState('');
  const [isAddingProvisional, setIsAddingProvisional] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(group.name);
      setDescription(group.description || '');
      setCoverImageUrl(group.cover_image_url || null);
      setCurrency(group.base_currency || 'EUR');
      setError('');
      setNewProvisionalName('');

      const namesMap: Record<string, string> = {};
      unclaimedMembers.forEach((m) => {
        namesMap[m.id] = m.provisional_name || m.profile?.full_name || '';
      });
      setProvisionalNames(namesMap);

      getGroupNotificationPreference(group.id).then((enabled) => {
        setNotificationsEnabled(enabled);
      });
    }
  }, [isOpen, group, groupMembers.length]);

  const handleToggleNotifications = async () => {
    if (isUpdatingNotifications) return;
    try {
      setIsUpdatingNotifications(true);
      const nextState = !notificationsEnabled;
      const result = await setGroupNotificationPreference(group.id, nextState);
      if (result.success) {
        setNotificationsEnabled(nextState);
      } else if (result.error) {
        alert(result.error);
      }
    } catch (err: any) {
      alert(err.message || 'Error al cambiar preferencia de notificaciones');
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleAddNewProvisional = async () => {
    if (!newProvisionalName.trim()) return;
    try {
      setIsAddingProvisional(true);
      await addUnclaimedMember(group.id, sanitizeText(newProvisionalName, 50));
      setNewProvisionalName('');
    } catch (err: any) {
      alert(err.message || 'Error al añadir participante provisional');
    } finally {
      setIsAddingProvisional(false);
    }
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

      // Update any changed provisional member names
      for (const m of unclaimedMembers) {
        const editedName = provisionalNames[m.id]?.trim();
        const currentName = m.provisional_name || m.profile?.full_name || '';
        if (editedName && editedName !== currentName) {
          await renameUnclaimedMember(group.id, m.id, editedName);
        }
      }

      const updated = await updateGroup(group.id, {
        name: sanitizeText(name, 80),
        description: sanitizeText(description, 300) || null,
        icon_emoji: group.icon_emoji || '🏖️',
        cover_image_url: coverImageUrl,
        base_currency: currency,
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#f59e0b'],
      });

      onClose();
      if (onSuccess) onSuccess(updated);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el grupo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleArchive = async () => {
    if (group.is_archived) {
      try {
        setIsArchiving(true);
        const restored = await restoreGroup(group.id);
        onClose();
        if (onSuccess) onSuccess(restored);
      } catch (err: any) {
        setError(err.message || 'Error al restaurar el grupo');
      } finally {
        setIsArchiving(false);
      }
    } else {
      if (
        confirm(
          t('groups.archiveConfirm', { name: group.name })
        )
      ) {
        try {
          setIsArchiving(true);
          const archived = await archiveGroup(group.id);
          onClose();
          if (onSuccess) onSuccess(archived);
        } catch (err: any) {
          setError(err.message || 'Error al archivar el grupo');
        } finally {
          setIsArchiving(false);
        }
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('groups.settings')}
      description={`Personaliza ${group.name}`}
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

          {currency !== group.base_currency && (
            <div className="p-3 mt-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>{t('groups.currencyChangeWarning')}</span>
            </div>
          )}
        </div>

        {/* Provisional / Unclaimed Members Management */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {t('groups.provisionalMembersTitle') || 'Participantes provisionales (sin reclamar)'}
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {unclaimedMembers.length}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('groups.provisionalMembersEditHint') || 'Modifica el nombre de los amigos que aún no han reclamado su puesto o añade más participantes provisionales.'}
          </p>

          {unclaimedMembers.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {unclaimedMembers.map((member, idx) => (
                <div key={member.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={provisionalNames[member.id] ?? (member.provisional_name || member.profile?.full_name || '')}
                    onChange={(e) =>
                      setProvisionalNames((prev) => ({
                        ...prev,
                        [member.id]: e.target.value,
                      }))
                    }
                    placeholder={`Nombre del participante ${idx + 1}`}
                    maxLength={50}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-1">
              {t('groups.noProvisionalMembers') || 'Todos los participantes actuales son usuarios reales registrados.'}
            </p>
          )}

          {/* Add new provisional member field */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2">
            <input
              type="text"
              value={newProvisionalName}
              onChange={(e) => setNewProvisionalName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewProvisional();
                }
              }}
              placeholder={t('groups.newProvisionalPlaceholder') || 'Añadir nuevo amigo provisional...'}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddNewProvisional}
              disabled={isAddingProvisional || !newProvisionalName.trim()}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 hover:bg-emerald-700 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('common.add') || 'Añadir'}</span>
            </button>
          </div>
        </div>

        {/* Group Notification Preferences */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Bell className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('notifications.groupTitle') || 'Notificaciones del Grupo'}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                {notificationsEnabled
                  ? (t('notifications.enabled') || 'Notificaciones: Activadas')
                  : (t('notifications.disabled') || 'Notificaciones: Desactivadas')}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                {t('notifications.enableOnJoinHint') || 'Recibe avisos cuando se registren nuevos gastos o liquidaciones.'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleNotifications}
              disabled={isUpdatingNotifications}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notificationsEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Admin Danger / Archive Zone */}
        {isAdmin && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('groups.adminZone')}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {group.is_archived ? t('groups.restoreGroup') : t('groups.archiveGroup')}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {group.is_archived
                    ? 'Restaura el grupo para que vuelva a estar visible.'
                    : 'Oculta el viaje de la vista principal.'}
                </span>
              </div>

              <Button
                type="button"
                variant={group.is_archived ? 'brand' : 'outline'}
                size="sm"
                isLoading={isArchiving}
                onClick={handleToggleArchive}
                className="shrink-0 text-xs font-bold gap-1.5"
              >
                {group.is_archived ? (
                  <>
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    <span>{t('groups.restoreGroup')}</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t('groups.archiveGroup')}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons (Sticky at bottom for mobile reachability) */}
        <div className="flex gap-3 pt-3 pb-2 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t border-slate-100 dark:border-slate-800 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 cursor-pointer">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="brand" isLoading={isLoading} className="flex-1 text-xs font-bold gap-1.5 cursor-pointer">
            <Check className="w-4 h-4" />
            {isLoading && currency !== group.base_currency
              ? t('groups.recalculatingCurrency', { currency })
              : t('groups.saveChanges')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

