'use client';

import React, { useState, useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import {
  Users,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  Shield,
} from 'lucide-react';

export interface AdminGroupMembersModalProps {
  groupId: string | null;
  groupName?: string;
  groupEmoji?: string;
  isOpen: boolean;
  onClose: () => void;
  onMembersUpdated?: () => void;
}

interface GroupMemberItem {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  is_unclaimed?: boolean;
  provisional_name?: string | null;
  profile: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    bizum_phone: string | null;
    is_banned?: boolean;
    role?: string;
  };
}

interface SystemUserOption {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

export const AdminGroupMembersModal: React.FC<AdminGroupMembersModalProps> = ({
  groupId,
  groupName,
  groupEmoji,
  isOpen,
  onClose,
  onMembersUpdated,
}) => {
  const { availableUsers } = usePachas();
  const { t } = useTranslation();

  const [members, setMembers] = useState<GroupMemberItem[]>([]);
  const [allSystemUsers, setAllSystemUsers] = useState<SystemUserOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add member state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin'>('member');
  const [isAdding, setIsAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!groupId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al cargar miembros del grupo');
      }
      const data = await res.json();
      setMembers(data.members || []);

      // Also fetch system users list from admin metrics if not already loaded
      if (allSystemUsers.length === 0) {
        const metricsRes = await fetch('/api/admin/metrics');
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          if (metricsData.usersList) {
            setAllSystemUsers(metricsData.usersList);
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al obtener miembros');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && groupId) {
      setSuccessMessage(null);
      setErrorMessage(null);
      setSelectedUserId('');
      fetchMembers();
    }
  }, [isOpen, groupId]);

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!groupId) return;
    const confirmed = window.confirm(
      t('admin.removeMemberConfirm') || `¿Seguro que deseas quitar a "${memberName}" de este grupo?`
    );
    if (!confirmed) return;

    setRemovingUserId(userId);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al quitar miembro');
      }

      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setSuccessMessage(t('admin.memberRemovedSuccess') || 'Miembro eliminado del grupo');
      onMembersUpdated?.();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al quitar miembro');
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !selectedUserId) return;

    setIsAdding(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al añadir miembro');
      }

      setSelectedUserId('');
      setSelectedRole('member');
      setSuccessMessage(t('admin.memberAddedSuccess') || 'Miembro añadido al grupo');
      await fetchMembers();
      onMembersUpdated?.();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al añadir miembro');
    } finally {
      setIsAdding(false);
    }
  };

  // Combine available users from context and admin metrics
  const effectiveUsersList: SystemUserOption[] = allSystemUsers.length > 0
    ? allSystemUsers
    : availableUsers.map((u) => ({
        id: u.id,
        full_name: u.full_name || '',
        email: u.email || '',
        avatar_url: u.avatar_url,
      }));

  const currentMemberIds = new Set(members.map((m) => m.user_id));
  const availableUsersToAdd = effectiveUsersList.filter((u) => !currentMemberIds.has(u.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${groupEmoji || '🏖️'} ${groupName || 'Grupo'} - ${t('admin.groupMembersTitle') || 'Miembros'}`}
      description={t('admin.groupMembersSubtitle') || 'Gestiona y añade miembros a este grupo como administrador.'}
      maxWidth="lg"
    >
      <div className="space-y-4">
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

        {/* Add Member Form */}
        <form
          onSubmit={handleAddMember}
          className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3"
        >
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            {t('admin.addMemberToGroup') || 'Añadir Miembro al Grupo'}
          </h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">
                {t('admin.selectUserPlaceholder') || 'Seleccionar un usuario del sistema...'}
              </option>
              {availableUsersToAdd.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || 'Sin nombre'} ({u.email})
                </option>
              ))}
            </select>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'member' | 'admin')}
              className="w-full sm:w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            >
              <option value="member">Miembro</option>
              <option value="admin">Admin grupo</option>
            </select>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!selectedUserId || isAdding}
              className="whitespace-nowrap"
            >
              {isAdding ? (
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

        {/* Current Members List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Miembros Actuales ({members.length})
            </h4>
          </div>

          {isLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <span className="text-xs">{t('common.loading') || 'Cargando miembros...'}</span>
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              {t('admin.noMembersInGroup') || 'No hay miembros en este grupo.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {members.map((m) => {
                const displayName = m.profile?.full_name || m.provisional_name || 'Amigo';
                const isGroupAdmin = m.role === 'admin';
                return (
                  <div
                    key={m.id}
                    className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        profile={m.profile as any}
                        size="sm"
                        className="w-8 h-8 text-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {displayName}
                          </span>
                          <Badge variant={isGroupAdmin ? 'purple' : 'gray'} size="sm">
                            {isGroupAdmin ? 'Admin' : 'Miembro'}
                          </Badge>
                          {m.is_unclaimed && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                              Provisional
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {m.profile?.email && <span className="truncate max-w-[160px]">{m.profile.email}</span>}
                          <span className="text-slate-300">•</span>
                          <span>Unido {new Date(m.joined_at).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={removingUserId === m.user_id}
                      onClick={() => handleRemoveMember(m.user_id, displayName)}
                      className="text-[11px] font-bold py-1 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                    >
                      {removingUserId === m.user_id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3 mr-1" />
                          Quitar
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common.close') || 'Cerrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
