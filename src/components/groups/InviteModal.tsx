'use client';

import React, { useState } from 'react';
import { Group, Profile } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Mail, MessageCircle, UserPlus, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export interface InviteModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ group, isOpen, onClose }) => {
  const { addMemberByEmail, addMemberToGroup, availableUsers, getGroupMembers, isDemoMode } = usePachas();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  const groupMembers = getGroupMembers(group.id);
  const nonMemberUsers = availableUsers.filter(
    (u) => !groupMembers.some((m) => m.user_id === u.id || m.profile?.email?.toLowerCase() === u.email.toLowerCase())
  );

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pachas.app';
  const inviteUrl = `${baseUrl}/join/${group.invite_code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = t('groups.whatsAppShareText', { name: group.name, url: inviteUrl });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage(t('groups.inviteByEmailPlaceholder'));
      return;
    }

    try {
      setEmailStatus('loading');
      setErrorMessage('');
      const added = await addMemberByEmail(group.id, email.trim());
      if (added) {
        setEmailStatus('success');
        setEmail('');
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10b981', '#34d399', '#f59e0b'],
        });
        setTimeout(() => setEmailStatus('idle'), 3000);
      } else {
        setErrorMessage(t('groups.inviteError'));
        setEmailStatus('error');
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('groups.inviteError'));
      setEmailStatus('error');
    }
  };

  const handleQuickAddLocalUser = async (user: Profile) => {
    try {
      setAddingUserId(user.id);
      await addMemberToGroup(group.id, user.id);
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#3b82f6', '#f59e0b'],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setAddingUserId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('groups.inviteFriendsModalTitle', { name: group.name })}
      description={t('groups.inviteSubtitle')}
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Quick Add Demo Local Users (Visible only in Demo / Development mode) */}
        {isDemoMode && nonMemberUsers.length > 0 && (
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('groups.quickAddLocal', { count: nonMemberUsers.length })}</span>
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                Demo
              </span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {nonMemberUsers.map((u) => {
                const isBanned = Boolean(u.is_banned);
                return (
                  <div
                    key={u.id}
                    className={`p-2 rounded-xl flex items-center justify-between gap-2 shadow-xs transition-colors ${
                      isBanned
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40'
                        : 'bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar profile={u} size="sm" className={isBanned ? 'opacity-75 ring-1 ring-rose-500/50' : ''} />
                        {isBanned && (
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[8px] font-bold">
                            🚫
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-bold truncate ${isBanned ? 'text-rose-900 dark:text-rose-200 line-through opacity-80' : 'text-slate-900 dark:text-white'}`}>
                            {u.full_name}
                          </span>
                          {isBanned && (
                            <span className="text-[9px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-800">
                              {t('groups.bannedMember') || 'Baneado'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">{u.email}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isBanned ? 'outline' : 'brand'}
                      disabled={isBanned || addingUserId === u.id}
                      isLoading={addingUserId === u.id}
                      onClick={() => handleQuickAddLocalUser(u)}
                      className={`text-xs h-7 px-2.5 shrink-0 gap-1 ${isBanned ? 'opacity-50 cursor-not-allowed text-rose-500 border-rose-200 dark:border-rose-800' : ''}`}
                      title={isBanned ? (t('groups.bannedMemberSubtitle') || 'Cuenta suspendida por moderación') : undefined}
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>{t('common.add')}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* QR Code & Link */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-white rounded-xl shadow-xs">
            <QRCodeSVG value={inviteUrl} size={130} level="M" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2.5">
            {t('groups.scanQr')}
          </span>
        </div>

        {/* Copy Link Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {t('groups.inviteLink')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 text-xs font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 select-all"
            />
            <Button
              size="sm"
              variant={copied ? 'brand' : 'secondary'}
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              {copied ? t('common.copied') : t('common.copy')}
            </Button>
          </div>
        </div>

        {/* Fast WhatsApp Share */}
        <div>
          <Button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full bg-[#25D366] hover:bg-[#1EBE5D] text-white font-semibold py-2.5 flex items-center justify-center gap-2 shadow-xs"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            {t('groups.shareWhatsApp')}
          </Button>
        </div>

        {/* Invite by Email / Name */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            {t('groups.orInviteByEmail')}
          </label>
          <form onSubmit={handleEmailInvite} className="flex gap-2">
            <Input
              placeholder={t('groups.inviteByEmailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="py-2 text-xs"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={emailStatus === 'loading'}
              className="shrink-0"
            >
              <Mail className="w-4 h-4" />
              {t('common.add')}
            </Button>
          </form>
          {emailStatus === 'success' && (
            <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {t('groups.inviteSuccess')}
            </p>
          )}
          {errorMessage && <p className="text-xs text-rose-500 font-medium mt-1.5">{errorMessage}</p>}
        </div>
      </div>
    </Modal>
  );
};

