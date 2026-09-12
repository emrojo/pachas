'use client';

import React, { useState, useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { DiceBearAvatarPicker, CURATED_DICEBEAR_PRESETS } from '@/components/profile/DiceBearAvatarPicker';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/locales';
import {
  User,
  Mail,
  Phone,
  Shield,
  Globe,
  Users,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';

export interface AdminEditUserModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => void;
}

interface UserGroupMembership {
  id: string;
  name: string;
  description: string | null;
  icon_emoji: string;
  base_currency: string;
  role: 'admin' | 'member';
  joined_at: string;
  is_unclaimed?: boolean;
}

interface AvailableGroup {
  id: string;
  name: string;
  icon_emoji: string;
  is_frozen?: boolean;
}

export const AdminEditUserModal: React.FC<AdminEditUserModalProps> = ({
  userId,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const { adminUpdateUser, currentUser } = usePachas();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'details' | 'groups'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // User details state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bizumPhone, setBizumPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('es');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [avatarUrl, setAvatarUrl] = useState<string>(CURATED_DICEBEAR_PRESETS[0]);
  const [isBanned, setIsBanned] = useState(false);
  const [isUnclaimed, setIsUnclaimed] = useState(false);

  // Groups state
  const [userGroups, setUserGroups] = useState<UserGroupMembership[]>([]);
  const [allGroups, setAllGroups] = useState<AvailableGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedGroupRole, setSelectedGroupRole] = useState<'member' | 'admin'>('member');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);

  const fetchUserData = async () => {
    if (!userId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al cargar usuario');
      }
      const data = await res.json();
      const u = data.user;
      setFullName(u.full_name || '');
      setEmail(u.email || '');
      setBizumPhone(u.bizum_phone || '');
      setPreferredLanguage(u.preferred_language || 'es');
      setRole(u.role === 'admin' ? 'admin' : 'member');
      setAvatarUrl(u.avatar_url || CURATED_DICEBEAR_PRESETS[0]);
      setIsBanned(Boolean(u.is_banned));
      setIsUnclaimed(Boolean(u.is_unclaimed));
      setUserGroups(data.groups || []);
      setAllGroups(data.allGroups || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al obtener datos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      setActiveTab('details');
      setSuccessMessage(null);
      setErrorMessage(null);
      fetchUserData();
    }
  }, [isOpen, userId]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      await adminUpdateUser(userId, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        bizum_phone: bizumPhone.trim() || undefined,
        preferred_language: preferredLanguage,
        role,
        avatar_url: avatarUrl,
      });

      setSuccessMessage(t('admin.userUpdatedSuccess') || 'Usuario actualizado correctamente');
      onUserUpdated?.();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFromGroup = async (groupId: string, groupName: string) => {
    if (!userId) return;
    const confirmed = window.confirm(
      t('admin.removeMemberConfirm') || `¿Seguro que deseas quitar a este usuario del grupo "${groupName}"?`
    );
    if (!confirmed) return;

    setRemovingGroupId(groupId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al quitar miembro del grupo');
      }

      setUserGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSuccessMessage(t('admin.memberRemovedSuccess') || 'Usuario eliminado del grupo');
      onUserUpdated?.();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al eliminar del grupo');
    } finally {
      setRemovingGroupId(null);
    }
  };

  const handleAddToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedGroupId) return;

    setIsAddingGroup(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role: selectedGroupRole,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al añadir miembro al grupo');
      }

      setSelectedGroupId('');
      setSelectedGroupRole('member');
      setSuccessMessage(t('admin.memberAddedSuccess') || 'Usuario añadido al grupo');
      await fetchUserData();
      onUserUpdated?.();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al añadir al grupo');
    } finally {
      setIsAddingGroup(false);
    }
  };

  const joinedGroupIds = new Set(userGroups.map((g) => g.id));
  const availableGroupsToAdd = allGroups.filter((g) => !joinedGroupIds.has(g.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.editUserTitle') || 'Editar Usuario'}
      description={t('admin.editUserSubtitle') || 'Modifica datos personales, roles y membresías de grupos.'}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            {t('admin.tabUserInfo') || 'Información Personal'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'groups'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            {t('admin.tabUserGroups') || 'Grupos y Membresías'}
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {userGroups.length}
            </span>
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="text-xs font-medium">{t('common.loading') || 'Cargando datos...'}</span>
          </div>
        ) : activeTab === 'details' ? (
          /* TAB 1: USER DETAILS FORM */
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Avatar
                profile={{
                  id: userId || '',
                  full_name: fullName || 'Usuario',
                  avatar_url: avatarUrl,
                  role,
                } as any}
                size="lg"
                className="w-14 h-14 text-lg border-2 border-white dark:border-slate-800 shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {fullName || 'Sin nombre'}
                  </h4>
                  {isUnclaimed && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                      ⏳ {t('admin.unclaimedUserBadge') || 'Sin reclamar'}
                    </span>
                  )}
                  {isBanned && (
                    <span className="px-1.5 py-0.5 text-[10px] font-black uppercase rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      Baneado
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {isUnclaimed ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {t('admin.unclaimedAccount') || 'Cuenta provisional'} · {email}
                    </span>
                  ) : (
                    email
                  )}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge variant={role === 'admin' ? 'purple' : 'gray'} size="sm">
                    {role === 'admin' ? 'Administrador' : 'Miembro'}
                  </Badge>
                </div>
              </div>
            </div>

            {isUnclaimed && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
                <span className="text-base">⏳</span>
                <div>
                  <span className="font-bold">{t('admin.unclaimedAccount') || 'Cuenta provisional'}: </span>
                  <span>Este miembro fue creado a mano en un grupo y aún no ha reclamado su perfil. Puedes modificar su nombre o membresías de grupo.</span>
                </div>
              </div>
            )}

            {/* Avatar Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Avatar del Usuario
              </label>
              <DiceBearAvatarPicker
                currentAvatarUrl={avatarUrl}
                onSelectAvatar={(url) => setAvatarUrl(url || '')}
                userName={fullName || 'Avatar'}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nombre Completo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9 text-xs"
                    placeholder="Ej. Carlos Martínez"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Correo Electrónico <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-xs"
                    placeholder="carlos@ejemplo.com"
                  />
                </div>
              </div>

              {/* Bizum Phone */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Teléfono Bizum <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="tel"
                    value={bizumPhone}
                    onChange={(e) => setBizumPhone(e.target.value)}
                    className="pl-9 text-xs"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>

              {/* Preferred Language */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Idioma Preferido
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Role Assignment */}
            <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                Rol en el Sistema
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('member')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'member'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-white font-bold ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold">Miembro</div>
                  <div className="text-[10px] text-slate-400 font-normal">Acceso estándar a grupos y gastos</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === 'admin'
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 text-slate-900 dark:text-white font-bold ring-1 ring-purple-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">Administrador</div>
                  <div className="text-[10px] text-slate-400 font-normal">Acceso total a la consola admin</div>
                </button>
              </div>
              {currentUser?.id === userId && role === 'member' && (
                <p className="text-[10px] text-amber-600 font-semibold mt-1">
                  ⚠️ Atención: Si quitas tu propio rol de administrador, perderás acceso a esta consola.
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('common.cancel') || 'Cancelar'}
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    {t('common.loading') || 'Guardando...'}
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    {t('common.save') || 'Guardar Cambios'}
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* TAB 2: GROUPS MANAGEMENT */
          <div className="space-y-4">
            {/* Add to Group Form */}
            <form onSubmit={handleAddToGroup} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                {t('admin.addMemberToGroup') || 'Añadir a un Grupo'}
              </h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">
                    {t('admin.selectGroupPlaceholder') || 'Seleccionar un grupo...'}
                  </option>
                  {availableGroupsToAdd.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.icon_emoji || '🏖️'} {g.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedGroupRole}
                  onChange={(e) => setSelectedGroupRole(e.target.value as 'member' | 'admin')}
                  className="w-full sm:w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                >
                  <option value="member">Miembro</option>
                  <option value="admin">Admin grupo</option>
                </select>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!selectedGroupId || isAddingGroup}
                  className="whitespace-nowrap"
                >
                  {isAddingGroup ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      {t('common.add') || 'Añadir'}
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Current Group Memberships */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Grupos a los que pertenece ({userGroups.length})
              </h4>

              {userGroups.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                  {t('admin.noGroupsJoined') || 'Este usuario no pertenece a ningún grupo actualmente.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                  {userGroups.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{g.icon_emoji || '🏖️'}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {g.name}
                            </span>
                            <Badge variant={g.role === 'admin' ? 'purple' : 'gray'} size="sm">
                              {g.role === 'admin' ? 'Admin' : 'Miembro'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Unido el {new Date(g.joined_at).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={removingGroupId === g.id}
                        onClick={() => handleRemoveFromGroup(g.id, g.name)}
                        className="text-[11px] font-bold py-1 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                      >
                        {removingGroupId === g.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-3 h-3 mr-1" />
                            Quitar
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('common.close') || 'Cerrar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
