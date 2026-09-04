'use client';

import React, { useState, useEffect } from 'react';
import { Group, Profile, GroupInvitation } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  Mail,
  MessageCircle,
  UserPlus,
  Sparkles,
  Send,
  Clock,
  RotateCw,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  ShieldAlert,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface InviteModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ group, isOpen, onClose }) => {
  const {
    addMemberByEmail,
    addMemberToGroup,
    sendGroupEmailInvite,
    getGroupInvitations,
    cancelGroupInvitation,
    resendGroupInvitation,
    getKnownContacts,
    isGroupAdmin,
    availableUsers,
    getGroupMembers,
    isDemoMode,
  } = usePachas();
  const { t } = useTranslation();
  const isAdmin = isGroupAdmin(group.id);

  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [showCustomMessage, setShowCustomMessage] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [actionInvId, setActionInvId] = useState<string | null>(null);

  // Known contacts state for group administrators
  const [knownContacts, setKnownContacts] = useState<(Profile & { shared_groups_count?: number })[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  const [contactActionFeedback, setContactActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const groupMembers = getGroupMembers(group.id);
  const nonMemberUsers = availableUsers.filter(
    (u) => !groupMembers.some((m) => m.user_id === u.id || m.profile?.email?.toLowerCase() === u.email.toLowerCase())
  );

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pachas.app';
  const inviteUrl = `${baseUrl}/join/${group.invite_code}`;

  useEffect(() => {
    if (isOpen && group?.id) {
      loadInvitations();
      if (isAdmin) {
        loadKnownContacts();
      }
    }
  }, [isOpen, group.id, isAdmin]);

  const loadKnownContacts = async () => {
    try {
      setIsLoadingContacts(true);
      const data = await getKnownContacts(group.id);
      setKnownContacts(data);
    } catch (err) {
      console.warn('Failed to load known contacts:', err);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleAddKnownContact = async (contact: Profile) => {
    try {
      setAddingContactId(contact.id);
      setContactActionFeedback(null);
      await addMemberToGroup(group.id, contact.id, contact);
      setContactActionFeedback({
        type: 'success',
        message: t('groups.addKnownUserSuccess', { name: contact.full_name || contact.email }),
      });
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#f59e0b'],
      });
      setKnownContacts((prev) => prev.filter((c) => c.id !== contact.id));
      setTimeout(() => {
        setContactActionFeedback(null);
      }, 4000);
    } catch (err: any) {
      setContactActionFeedback({
        type: 'error',
        message: err.message || t('groups.inviteError'),
      });
    } finally {
      setAddingContactId(null);
    }
  };

  const filteredContacts = knownContacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const loadInvitations = async () => {
    try {
      setIsLoadingInvitations(true);
      const data = await getGroupInvitations(group.id);
      setInvitations(data);
    } catch (err) {
      console.warn('Failed to load group invitations:', err);
    } finally {
      setIsLoadingInvitations(false);
    }
  };

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
      setStatusMessage('');

      const res = await sendGroupEmailInvite(group.id, email.trim(), customMessage.trim() || undefined);
      setEmailStatus('success');
      setStatusMessage(res.message || t('groups.inviteSuccess'));
      setEmail('');
      setCustomMessage('');
      setShowCustomMessage(false);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#f59e0b'],
      });
      loadInvitations();
      setTimeout(() => {
        setEmailStatus('idle');
        setStatusMessage('');
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err.message || t('groups.inviteError'));
      setEmailStatus('error');
    }
  };

  const handleResend = async (invId: string) => {
    try {
      setActionInvId(invId);
      const ok = await resendGroupInvitation(group.id, invId);
      if (ok) {
        confetti({
          particleCount: 30,
          spread: 40,
          origin: { y: 0.7 },
          colors: ['#10b981', '#38bdf8'],
        });
        loadInvitations();
      }
    } catch (err) {
      console.error('Failed to resend invite:', err);
    } finally {
      setActionInvId(null);
    }
  };

  const handleCancel = async (invId: string) => {
    try {
      setActionInvId(invId);
      const ok = await cancelGroupInvitation(group.id, invId);
      if (ok) {
        loadInvitations();
      }
    } catch (err) {
      console.error('Failed to cancel invite:', err);
    } finally {
      setActionInvId(null);
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

        {/* Sección Exclusiva para Administradores: Añadir Usuarios Conocidos */}
        {isAdmin && (
          <div className="p-4 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-slate-50 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-slate-900/40 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    {t('groups.knownUsersTitle')}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('groups.knownUsersSubtitle')}
                  </p>
                </div>
              </div>
              <Badge variant="emerald" size="sm" className="text-[10px] font-bold tracking-tight">
                {t('groups.groupAdmin')}
              </Badge>
            </div>

            {/* AVISO IMPORTANTE DE CONFIANZA Y NATURALEZA INFORMATIVA */}
            <div className="p-3 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-900/50 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed shadow-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  {t('groups.knownUsersTrustWarning')}
                </p>
              </div>
            </div>

            {/* Feedback message if any */}
            {contactActionFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  contactActionFeedback.type === 'success'
                    ? 'bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-800'
                    : 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-300/80 dark:border-rose-800'
                }`}
              >
                {contactActionFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{contactActionFeedback.message}</span>
              </div>
            )}

            {/* Buscador de contactos conocidos */}
            {knownContacts.length > 2 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder={t('groups.knownUsersSearchPlaceholder')}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            )}

            {/* Lista de contactos */}
            {isLoadingContacts ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Cargando contactos...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="py-2.5 text-center text-[11px] text-slate-400 dark:text-slate-500 italic bg-white/60 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                {t('groups.knownUsersEmpty')}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar profile={contact} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {contact.full_name}
                          </span>
                          {contact.shared_groups_count && contact.shared_groups_count > 1 && (
                            <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                              {t('groups.knownUsersSharedCount', { count: contact.shared_groups_count })}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">{contact.email}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="brand"
                      disabled={addingContactId === contact.id}
                      isLoading={addingContactId === contact.id}
                      onClick={() => handleAddKnownContact(contact)}
                      className="text-xs h-7 px-3 shrink-0 gap-1 font-semibold"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>{t('groups.addKnownUserBtn')}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
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

        {/* Invite by Email */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t('groups.orInviteByEmail')}
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t('groups.inviteByEmailSubtitle')}
            </p>
          </div>

          <form onSubmit={handleEmailInvite} className="space-y-2.5">
            <div className="flex gap-2">
              <Input
                placeholder={t('groups.inviteEmailsPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="py-2 text-xs flex-1"
                disabled={emailStatus === 'loading'}
              />
              <Button
                type="submit"
                variant="brand"
                size="sm"
                isLoading={emailStatus === 'loading'}
                disabled={!email.trim() || emailStatus === 'loading'}
                className="shrink-0 gap-1 text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                {t('groups.sendEmailInviteBtn')}
              </Button>
            </div>

            {/* Optional custom message */}
            <div>
              <button
                type="button"
                onClick={() => setShowCustomMessage(!showCustomMessage)}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                {showCustomMessage ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {t('groups.customMessageOptional')}
              </button>

              {showCustomMessage && (
                <div className="mt-2">
                  <textarea
                    rows={2}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={t('groups.customMessagePlaceholder')}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              )}
            </div>
          </form>

          {emailStatus === 'success' && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage || t('groups.inviteSuccess')}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <X className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Pending Invitations List */}
          {invitations.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {t('groups.pendingInvitationsTitle')} ({invitations.length})
                </span>
                {isLoadingInvitations && <RotateCw className="w-3 h-3 animate-spin text-slate-400" />}
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {invitations.map((inv) => {
                  const isPending = inv.status === 'pending';
                  const isAccepted = inv.status === 'accepted';
                  const isActionLoading = actionInvId === inv.id;

                  return (
                    <div
                      key={inv.id}
                      className="p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {inv.email}
                          </p>
                          {inv.custom_message && (
                            <p className="text-[10px] text-slate-400 italic truncate max-w-[200px]">
                              "{inv.custom_message}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3" />
                            {t('groups.inviteStatusAccepted')}
                          </span>
                        ) : isPending ? (
                          <>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                              {t('groups.inviteStatusPending')}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isActionLoading}
                              isLoading={isActionLoading}
                              onClick={() => handleResend(inv.id)}
                              className="h-6 px-1.5 text-[11px] text-emerald-600 hover:text-emerald-700"
                              title={t('groups.resendInvite')}
                            >
                              <RotateCw className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isActionLoading}
                              onClick={() => handleCancel(inv.id)}
                              className="h-6 px-1.5 text-[11px] text-rose-500 hover:text-rose-600"
                              title={t('groups.cancelInvite')}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">
                            {t('groups.inviteStatusCancelled')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

