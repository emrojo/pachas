'use client';

import React, { useState } from 'react';
import { GroupMember } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Phone, Shield, ShieldCheck, ShieldAlert, UserMinus, AlertTriangle, Check } from 'lucide-react';

export interface MemberListProps {
  groupId?: string;
  members: GroupMember[];
  isAdmin?: boolean;
}

export const MemberList: React.FC<MemberListProps> = ({ groupId, members, isAdmin }) => {
  const { currentUser, removeMemberFromGroup, updateMemberRole, getGroup } = usePachas();
  const { t } = useTranslation();
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [memberToToggleRole, setMemberToToggleRole] = useState<GroupMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const group = groupId ? getGroup(groupId) : undefined;

  const handleConfirmRemove = async () => {
    if (!groupId || !memberToRemove) return;
    try {
      setIsRemoving(true);
      await removeMemberFromGroup(groupId, memberToRemove.user_id);
      setMemberToRemove(null);
    } catch (err) {
      console.error('Error removing member:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleConfirmToggleRole = async () => {
    if (!groupId || !memberToToggleRole) return;
    try {
      setIsUpdatingRole(true);
      const newRole = memberToToggleRole.role === 'admin' ? 'member' : 'admin';
      await updateMemberRole(groupId, memberToToggleRole.user_id, newRole);
      setMemberToToggleRole(null);
    } catch (err) {
      console.error('Error toggling member role:', err);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
    <>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {members.map((member) => {
          const isCurrentUser = currentUser ? member.user_id === currentUser.id : false;
          const canRemove = groupId && (isAdmin || isCurrentUser);
          const isCreator = group ? group.created_by === member.user_id : false;
          const canToggleAdmin = groupId && isAdmin && !isCurrentUser && !isCreator;
          const isBanned = Boolean(member.profile?.is_banned);

          return (
            <div
              key={member.id}
              className={`py-3.5 flex items-center justify-between gap-3 transition-colors ${
                isBanned
                  ? 'bg-rose-50/60 dark:bg-rose-950/30 px-3.5 rounded-2xl border border-rose-200/70 dark:border-rose-900/50 my-1'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Avatar
                    profile={member.profile}
                    size="md"
                    className={isBanned ? 'opacity-75 ring-2 ring-rose-500/60 ring-offset-1' : ''}
                  />
                  {isBanned && (
                    <div
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold shadow-xs"
                      title={t('groups.bannedMember') || 'Baneado'}
                    >
                      🚫
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isBanned
                          ? 'text-rose-900 dark:text-rose-200 line-through opacity-80'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {member.profile?.full_name || t('common.friend')}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-1.5 py-0.5 rounded">
                        {t('common.you')}
                      </span>
                    )}
                    {isBanned ? (
                      <Badge
                        variant="rose"
                        size="sm"
                        className="bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 gap-1 font-bold"
                      >
                        <ShieldAlert className="w-2.5 h-2.5" />
                        {t('groups.bannedMember') || 'Baneado'}
                      </Badge>
                    ) : member.role === 'admin' ? (
                      <Badge variant="amber" size="sm">
                        <Shield className="w-2.5 h-2.5" />
                        {t('groups.groupAdmin') || 'Admin del grupo'}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                    {member.profile?.email || ''}
                  </span>
                  {isBanned && (
                    <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {member.profile?.ban_reason || t('groups.bannedMemberSubtitle') || 'Cuenta suspendida por moderación'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Bizum phone badge if available */}
                {member.profile?.bizum_phone && !isBanned && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                    <Phone className="w-3 h-3" />
                    <span>{member.profile.bizum_phone}</span>
                  </div>
                )}

                {/* Group Admin Toggle Button */}
                {canToggleAdmin && !isBanned && (
                  <button
                    type="button"
                    onClick={() => setMemberToToggleRole(member)}
                    className={`px-2 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                      member.role === 'admin'
                        ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 hover:bg-amber-100'
                        : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                    title={
                      member.role === 'admin'
                        ? (t('groups.removeAdmin') || 'Quitar Admin del grupo')
                        : (t('groups.makeAdmin') || 'Hacer Admin del grupo')
                    }
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {member.role === 'admin'
                        ? (t('groups.removeAdmin') || 'Quitar Admin')
                        : (t('groups.makeAdmin') || 'Hacer Admin')}
                    </span>
                  </button>
                )}

                {/* Remove Member Button */}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => setMemberToRemove(member)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    title={isCurrentUser ? 'Salir del grupo' : `Quitar a ${member.profile?.full_name || 'este amigo'} del grupo`}
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title={t('groups.removeMemberTitle')}
        description={t('groups.removeMemberSubtitle')}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              {t('groups.removeMemberConfirm', { name: memberToRemove?.profile?.full_name || t('common.friend') })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              isLoading={isRemoving}
              onClick={handleConfirmRemove}
              className="gap-1.5 font-bold"
            >
              <UserMinus className="w-4 h-4" />
              <span>{t('groups.removeMemberBtn')}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Group Admin Role Toggle Modal */}
      <Modal
        isOpen={!!memberToToggleRole}
        onClose={() => setMemberToToggleRole(null)}
        title={
          memberToToggleRole?.role === 'admin'
            ? (t('groups.removeAdmin') || 'Quitar Administrador del Grupo')
            : (t('groups.makeAdmin') || 'Nombrar Administrador del Grupo')
        }
        description={
          memberToToggleRole?.role === 'admin'
            ? 'Retirar permisos de administración en este grupo'
            : 'Otorgar permisos de administración en este grupo'
        }
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              {memberToToggleRole?.role === 'admin'
                ? (t('groups.removeAdminPrompt', { name: memberToToggleRole?.profile?.full_name || 'este amigo' }) || `¿Deseas retirar los permisos de administrador del grupo a ${memberToToggleRole?.profile?.full_name}?`)
                : (t('groups.makeAdminPrompt', { name: memberToToggleRole?.profile?.full_name || 'este amigo' }) || `¿Deseas nombrar administrador a ${memberToToggleRole?.profile?.full_name}? Podrá editar la información, divisa y gestionar participantes en este grupo.`)}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemberToToggleRole(null)}
              disabled={isUpdatingRole}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="brand"
              size="sm"
              isLoading={isUpdatingRole}
              onClick={handleConfirmToggleRole}
              className="gap-1.5 font-bold"
            >
              <Check className="w-4 h-4" />
              <span>
                {memberToToggleRole?.role === 'admin'
                  ? (t('groups.removeAdmin') || 'Quitar Admin')
                  : (t('groups.makeAdmin') || 'Hacer Admin')}
              </span>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

