'use client';

import React, { useState } from 'react';
import { GroupMember } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserMinus,
  AlertTriangle,
  Check,
  Link as LinkIcon,
  Copy,
  Edit2,
  Undo2,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { buildClaimUrl } from '@/lib/groups/unclaimedMembers';

export interface MemberListProps {
  groupId?: string;
  members: GroupMember[];
  isAdmin?: boolean;
}

export const MemberList: React.FC<MemberListProps> = ({ groupId, members, isAdmin }) => {
  const {
    currentUser,
    removeMemberFromGroup,
    updateMemberRole,
    getGroup,
    renameUnclaimedMember,
    renounceMember,
    claimMember,
  } = usePachas();
  const { t } = useTranslation();
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [memberToToggleRole, setMemberToToggleRole] = useState<GroupMember | null>(null);
  const [memberToRename, setMemberToRename] = useState<GroupMember | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [memberToRenounce, setMemberToRenounce] = useState<GroupMember | null>(null);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isRenouncing, setIsRenouncing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const group = groupId ? getGroup(groupId) : undefined;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pachas.app';

  const handleCopyClaimLink = async (member: GroupMember) => {
    if (!group || !member.claim_token) return;
    const url = buildClaimUrl(baseUrl, group.invite_code, member.claim_token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedMemberId(member.id);
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#10b981', '#059669', '#34d399'],
      });
      setTimeout(() => {
        setCopiedMemberId(null);
      }, 3000);
    } catch {
      alert(`Enlace único de invitación:\n${url}`);
    }
  };

  const handleOpenRename = (member: GroupMember) => {
    setMemberToRename(member);
    setRenameInput(member.provisional_name || member.profile?.full_name || '');
  };

  const handleConfirmRename = async () => {
    if (!groupId || !memberToRename || !renameInput.trim()) return;
    try {
      setIsRenaming(true);
      await renameUnclaimedMember(groupId, memberToRename.id, renameInput.trim());
      setMemberToRename(null);
    } catch (err: any) {
      alert(err.message || 'Error al renombrar');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConfirmRenounce = async () => {
    if (!groupId || !memberToRenounce) return;
    try {
      setIsRenouncing(true);
      await renounceMember(groupId, memberToRenounce.id);
      setMemberToRenounce(null);
    } catch (err: any) {
      alert(err.message || 'Error al renunciar al puesto');
    } finally {
      setIsRenouncing(false);
    }
  };

  const handleDirectClaim = async (member: GroupMember) => {
    if (!member.claim_token) return;
    if (confirm(`¿Deseas reclamar el puesto de ${member.provisional_name || 'este participante'} como tuyo? Tus datos reales sustituirán a este perfil y se te asignarán sus gastos.`)) {
      try {
        setIsClaiming(true);
        await claimMember(member.claim_token);
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#f59e0b'],
        });
      } catch (err: any) {
        alert(err.message || 'Error al reclamar puesto');
      } finally {
        setIsClaiming(false);
      }
    }
  };

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

          const isUnclaimed = Boolean(member.is_unclaimed);
          const isClaimedFromProvisional = !isUnclaimed && Boolean(member.provisional_name || member.claimed_by);
          const canRenounce = groupId && (isCurrentUser || isAdmin) && isClaimedFromProvisional;
          const canClaimDirectly = isUnclaimed && currentUser && !isCurrentUser;

          return (
            <div
              key={member.id}
              className={`py-3.5 flex items-center justify-between gap-3 transition-colors ${
                isBanned
                  ? 'bg-rose-50/60 dark:bg-rose-950/30 px-3.5 rounded-2xl border border-rose-200/70 dark:border-rose-900/50 my-1'
                  : isUnclaimed
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 px-3.5 rounded-2xl border border-amber-200/50 dark:border-amber-900/40 my-1'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Avatar
                    profile={member.profile}
                    size="md"
                    className={`${isBanned ? 'opacity-75 ring-2 ring-rose-500/60 ring-offset-1' : ''} ${
                      isUnclaimed ? 'border-2 border-dashed border-amber-400 opacity-90' : ''
                    }`}
                  />
                  {isBanned ? (
                    <div
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold shadow-xs"
                      title={t('groups.bannedMember') || 'Baneado'}
                    >
                      🚫
                    </div>
                  ) : isUnclaimed ? (
                    <div
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs"
                      title="Participante provisional sin reclamar"
                    >
                      ✨
                    </div>
                  ) : null}
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
                      {member.provisional_name || member.profile?.full_name || t('common.friend')}
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
                    ) : isUnclaimed ? (
                      <Badge
                        variant="amber"
                        size="sm"
                        className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 gap-1 font-bold"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        {t('groups.unclaimedBadge') || 'Sin reclamar'}
                      </Badge>
                    ) : member.role === 'admin' ? (
                      <Badge variant="amber" size="sm">
                        <Shield className="w-2.5 h-2.5" />
                        {t('groups.groupAdmin') || 'Admin del grupo'}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                    {isUnclaimed ? 'Puesto provisional para invitar a un amigo' : member.profile?.email || ''}
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

              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                {/* Unclaimed Member Actions */}
                {isUnclaimed && (
                  <>
                    {/* Copy Unique Claim Link */}
                    <button
                      type="button"
                      onClick={() => handleCopyClaimLink(member)}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl transition-colors border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1"
                      title="Copiar enlace único para reclamar este puesto"
                    >
                      {copiedMemberId === member.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('common.copied') || '¡Copiado!'}</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('groups.copyClaimLink') || 'Enlace único'}</span>
                        </>
                      )}
                    </button>

                    {/* Rename Provisional Member Button */}
                    {(isAdmin || isCurrentUser) && (
                      <button
                        type="button"
                        onClick={() => handleOpenRename(member)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        title="Cambiar nombre inicial"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Direct Claim Button for real user */}
                    {canClaimDirectly && (
                      <button
                        type="button"
                        onClick={() => handleDirectClaim(member)}
                        disabled={isClaiming}
                        className="px-2 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-colors border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1"
                        title="Reclamar este puesto para tu cuenta"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('groups.claimSlot') || 'Reclamar'}</span>
                      </button>
                    )}
                  </>
                )}

                {/* Renounce Claimed Member Slot Button */}
                {canRenounce && (
                  <button
                    type="button"
                    onClick={() => setMemberToRenounce(member)}
                    className="px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-colors border border-rose-200 dark:border-rose-900/60 flex items-center gap-1"
                    title="Renunciar a este puesto para dejarlo libre"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('groups.renounceSlot') || 'Renunciar'}</span>
                  </button>
                )}

                {/* Bizum phone badge if available */}
                {member.profile?.bizum_phone && !isBanned && !isUnclaimed && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                    <Phone className="w-3 h-3" />
                    <span>{member.profile.bizum_phone}</span>
                  </div>
                )}

                {/* Group Admin Toggle Button */}
                {canToggleAdmin && !isBanned && !isUnclaimed && (
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
                    title={isCurrentUser ? 'Salir del grupo' : `Quitar a ${member.provisional_name || member.profile?.full_name || 'este amigo'} del grupo`}
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

      {/* Rename Provisional Member Modal */}
      <Modal
        isOpen={!!memberToRename}
        onClose={() => setMemberToRename(null)}
        title={t('groups.renameProvisionalTitle') || 'Cambiar Nombre Inicial'}
        description={t('groups.renameProvisionalSubtitle') || 'Actualiza el nombre provisional de este participante'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('groups.provisionalNameLabel') || 'Nombre inicial'}
            </label>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmRename();
                }
              }}
              placeholder="Ej. Lucas, Marta..."
              maxLength={50}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemberToRename(null)}
              disabled={isRenaming}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="brand"
              size="sm"
              isLoading={isRenaming}
              disabled={!renameInput.trim()}
              onClick={handleConfirmRename}
              className="gap-1.5 font-bold"
            >
              <Check className="w-4 h-4" />
              <span>{t('common.save') || 'Guardar'}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Renounce Member Slot Confirmation Modal */}
      <Modal
        isOpen={!!memberToRenounce}
        onClose={() => setMemberToRenounce(null)}
        title={t('groups.renounceModalTitle') || 'Renunciar a este puesto'}
        description={t('groups.renounceModalSubtitle') || 'Liberar puesto para que otro amigo lo reclame'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
              {t('groups.renounceConfirmPrompt', {
                name: memberToRenounce?.provisional_name || memberToRenounce?.profile?.full_name || 'este participante',
              }) ||
                `¿Estás seguro de que deseas renunciar al puesto de ${
                  memberToRenounce?.provisional_name || memberToRenounce?.profile?.full_name
                }? El puesto volverá a quedar como participante libre y todos sus gastos asociados se conservarán intactos para que otra persona pueda reclamarlo.`}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemberToRenounce(null)}
              disabled={isRenouncing}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              isLoading={isRenouncing}
              onClick={handleConfirmRenounce}
              className="gap-1.5 font-bold"
            >
              <Undo2 className="w-4 h-4" />
              <span>{t('groups.confirmRenounceBtn') || 'Sí, renunciar al puesto'}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

