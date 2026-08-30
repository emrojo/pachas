'use client';

import React, { useState } from 'react';
import { GroupMember } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Phone, Shield, UserMinus, AlertTriangle } from 'lucide-react';

export interface MemberListProps {
  groupId?: string;
  members: GroupMember[];
  isAdmin?: boolean;
}

export const MemberList: React.FC<MemberListProps> = ({ groupId, members, isAdmin }) => {
  const { currentUser, removeMemberFromGroup } = usePachas();
  const { t } = useTranslation();
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

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

  return (
    <>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {members.map((member) => {
          const isCurrentUser = currentUser ? member.user_id === currentUser.id : false;
          const canRemove = groupId && (isAdmin || isCurrentUser);

          return (
            <div key={member.id} className="py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar profile={member.profile} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {member.profile?.full_name || t('common.friend')}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-1.5 py-0.5 rounded">
                        {t('common.you')}
                      </span>
                    )}
                    {member.role === 'admin' ? (
                      <Badge variant="amber" size="sm">
                        <Shield className="w-2.5 h-2.5" />
                        {t('groups.groupAdmin') || 'Admin del grupo'}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                    {member.profile?.email || ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Bizum phone badge if available */}
                {member.profile?.bizum_phone && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                    <Phone className="w-3 h-3" />
                    <span>{member.profile.bizum_phone}</span>
                  </div>
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

      {/* Confirmation Modal */}
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
    </>
  );
};

