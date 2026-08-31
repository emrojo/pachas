'use client';

import React, { useState } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Profile } from '@/types/database';
import { sanitizeText } from '@/lib/security/sanitize';
import confetti from 'canvas-confetti';

import {
  User,
  Mail,
  Phone,
  UserPlus,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { DiceBearAvatarPicker, CURATED_DICEBEAR_PRESETS } from '@/components/profile/DiceBearAvatarPicker';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/locales';

export interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: Profile) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createLocalUser, groups, availableUsers, isCurrentUserAdmin } = usePachas();
  const { t, language } = useTranslation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bizumPhone, setBizumPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>(language);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(CURATED_DICEBEAR_PRESETS[0]);
  const [addToAllGroups, setAddToAllGroups] = useState(true);
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Generate suggested email from full name
  const handleNameChange = (name: string) => {
    setFullName(name);
    if (!email || email.endsWith('@pachas.com') || email.endsWith('@ejemplo.com')) {
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
      if (slug) {
        setEmail(`${slug}@pachas.com`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage(t('auth.nameRequired'));
      return;
    }
    if (!email.trim()) {
      setErrorMessage(t('auth.email'));
      return;
    }

    // Check if email already exists in availableUsers
    const existing = availableUsers.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (existing) {
      setErrorMessage(`Ya existe un usuario con el correo "${email}".`);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');

      const groupIdsToAdd = addToAllGroups ? groups.map((g) => g.id) : [];

      const created = await createLocalUser({
        full_name: sanitizeText(fullName, 100),
        email: sanitizeText(email, 120).toLowerCase(),
        bizum_phone: sanitizeText(bizumPhone, 25) || undefined,
        preferred_language: preferredLanguage,
        avatar_url: selectedAvatar,
        autoSwitch,
        addToGroupIds: groupIdsToAdd,
      });

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b'],
      });

      // Reset
      setFullName('');
      setEmail('');
      setBizumPhone('');
      onClose();
      if (onSuccess) onSuccess(created);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al crear el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  const previewProfile: Profile = {
    id: 'preview',
    full_name: fullName || 'Nuevo Amigo',
    email: email || 'amigo@pachas.com',
    avatar_url: selectedAvatar,
    bizum_phone: bizumPhone || undefined,
    created_at: new Date().toISOString(),
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear Usuario"
      description="Registra nuevos perfiles para asociar gastos y repartos"
      maxWidth="md"
    >
      {!isCurrentUserAdmin ? (
        <div className="space-y-4 py-2">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Acción restringida a Administradores
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                No tienes permisos de administrador. Solo los administradores pueden crear nuevos usuarios.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Avatar & Preview */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <Avatar profile={previewProfile} size="lg" className="ring-2 ring-emerald-500/40 shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                {fullName || 'Nombre del usuario'}
              </span>
              <span className="text-xs text-slate-400 block truncate">
                {email || 'correo@ejemplo.com'}
              </span>
              {bizumPhone && (
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block">
                  Bizum: {bizumPhone}
                </span>
              )}
            </div>
          </div>

          {/* DiceBear Avatar Picker */}
          <DiceBearAvatarPicker
            currentAvatarUrl={selectedAvatar}
            onSelectAvatar={(url) => setSelectedAvatar(url || CURATED_DICEBEAR_PRESETS[0])}
            userName={fullName}
          />

          {/* Input Fields */}
          <div className="space-y-3">
            <Input
              label={`${t('auth.fullName')} *`}
              placeholder="Laura Gómez"
              value={fullName}
              onChange={(e) => handleNameChange(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
              autoFocus
            />

            <Input
              label={`${t('auth.email')} *`}
              placeholder="laura@pachas.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label={t('auth.phoneForBizum')}
              placeholder="+34 611 222 333"
              value={bizumPhone}
              onChange={(e) => setBizumPhone(e.target.value)}
              leftIcon={<Phone className="w-4 h-4" />}
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {t('auth.preferredLanguage')}
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Group membership & session options */}
          <div className="space-y-2 pt-1">
            {groups.length > 0 && (
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addToAllGroups}
                  onChange={(e) => setAddToAllGroups(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Añadir automáticamente a mis {groups.length} grupo(s) actuales
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {groups.map((g) => g.name).join(', ')}
                  </span>
                </div>
              </label>
            )}

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSwitch}
                onChange={(e) => setAutoSwitch(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Iniciar sesión como este usuario inmediatamente
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Cambiarás a su vista para simular pagos y repartos desde su cuenta
                </span>
              </div>
            </label>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="brand" isLoading={isLoading} className="flex-1 text-xs font-bold gap-1.5">
              <UserPlus className="w-4 h-4" />
              Crear Usuario
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

